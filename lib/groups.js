import "server-only";

import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";

import { client, connectDb, db } from "./db.js";
import { mapGroup } from "./groupMapper.mjs";
import { hashInviteToken } from "./inviteTokens.mjs";
import {
  isReceiptImageKeyForGroup,
  receiptImageExists,
  removeReceiptImage,
} from "./receiptOcr.mjs";

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function idVariants(value) {
  const id = String(value);
  return ObjectId.isValid(id) ? [id, ObjectId.createFromHexString(id)] : [id];
}

function cleanText(value, label, maxLength = 80) {
  const text = String(value ?? "").trim();

  if (!text) fail(400, `${label}을(를) 입력해 주세요.`);
  if (text.length > maxLength) {
    fail(400, `${label}은(는) ${maxLength}자 이하여야 해요.`);
  }

  return text;
}

async function transaction(work) {
  await connectDb();
  const session = client.startSession();

  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

async function attachGroupData(groups) {
  if (groups.length === 0) return [];

  const groupIds = groups.map((group) => group._id);
  const [members, receipts] = await Promise.all([
    db.collection("group_member").find({ group_id: { $in: groupIds } }).toArray(),
    db
      .collection("receipts")
      .find({ group_id: { $in: groupIds } })
      .sort({ created_at: 1 })
      .toArray(),
  ]);

  return groups.map((group) => {
    const groupId = String(group._id);
    return mapGroup(
      group,
      members.filter((member) => String(member.group_id) === groupId),
      receipts.filter((receipt) => String(receipt.group_id) === groupId),
    );
  });
}

export async function listGroups(userId) {
  await connectDb();
  const userIds = idVariants(userId);
  const memberships = await db
    .collection("group_member")
    .find({ user_id: { $in: userIds } }, { projection: { group_id: 1 } })
    .toArray();
  const groups = await db
    .collection("expense_group")
    .find({
      status: { $ne: "WAITING" },
      $or: [
        { created_by: { $in: userIds } },
        { _id: { $in: memberships.map((member) => member.group_id) } },
      ],
    })
    .sort({ created_at: -1 })
    .toArray();

  return attachGroupData(groups);
}

export async function getGroupViewer(groupId, credentials = {}) {
  await connectDb();
  const group = await db.collection("expense_group").findOne({
    _id: { $in: idVariants(groupId) },
  });

  if (!group) fail(404, "모임을 찾을 수 없어요.");

  if (credentials.userId) {
    const userId = String(credentials.userId);
    const member = await db.collection("group_member").findOne({
      group_id: group._id,
      user_id: { $in: idVariants(userId) },
    });
    const isCaptain = String(group.created_by) === userId;

    if (!member && !isCaptain) {
      fail(403, "이 모임에 접근할 수 없어요.");
    }

    return { group, member, isCaptain, kind: "user" };
  }

  if (credentials.guestToken) {
    const guestSession = await db.collection("guest_session").findOne({
      group_id: group._id,
      token_hash: hashInviteToken(credentials.guestToken),
      expires_at: { $gt: new Date() },
    });

    if (guestSession) {
      const member = await db.collection("group_member").findOne({
        _id: guestSession.member_id,
        group_id: group._id,
      });

      if (member) {
        return { group, member, isCaptain: false, kind: "guest" };
      }
    }
  }

  fail(401, "로그인하거나 유효한 초대 링크로 참여해 주세요.");
}

export async function getGroupView(groupId, credentials) {
  const viewer = await getGroupViewer(groupId, credentials);
  const group = (await attachGroupData([viewer.group]))[0];

  return {
    group,
    viewer: {
      memberId: viewer.member ? String(viewer.member._id) : null,
      nickname: viewer.member?.nickname ?? "총대",
      isCaptain: viewer.isCaptain,
      kind: viewer.kind,
    },
  };
}

export async function getGroup(groupId, userId) {
  try {
    return (await getGroupView(groupId, { userId })).group;
  } catch (error) {
    if ([401, 403, 404].includes(Number(error?.status))) return null;

    throw error;
  }
}

export async function createGroup(user, input) {
  const mode = input?.mode;
  if (!["SOLO", "TOGETHER"].includes(mode)) {
    fail(400, "정산 방식을 선택해 주세요.");
  }

  const name = cleanText(input?.name, "모임 이름");
  const captainNickname = cleanText(user.nickname, "총대 별명", 40);
  const participantNames = (Array.isArray(input?.participants)
    ? input.participants
    : []
  ).map((participant) => cleanText(participant?.nickname, "참여자 별명", 40));
  const comparableNames = [captainNickname, ...participantNames].map(
    (nickname) => nickname.toLocaleLowerCase("ko-KR"),
  );

  if (new Set(comparableNames).size !== comparableNames.length) {
    fail(400, "참여자 별명은 서로 다르게 입력해 주세요.");
  }

  const expectedMemberCount =
    mode === "TOGETHER"
      ? Number(input?.expectedMemberCount)
      : participantNames.length + 1;
  const minimumMemberCount = mode === "TOGETHER" ? 2 : 1;
  const maximumMemberCount = mode === "TOGETHER" ? 8 : 50;

  if (
    !Number.isInteger(expectedMemberCount) ||
    expectedMemberCount < minimumMemberCount ||
    expectedMemberCount > maximumMemberCount ||
    (mode === "TOGETHER" && participantNames.length !== expectedMemberCount - 1)
  ) {
    fail(400, "참여 인원 정보를 확인해 주세요.");
  }

  const groupId = randomUUID();
  const now = new Date();
  const captain = {
    _id: randomUUID(),
    group_id: groupId,
    user_id: String(user.id),
    nickname: captainNickname,
    member_type: "registered",
  };
  const guests = participantNames.map((nickname) => ({
    _id: randomUUID(),
    group_id: groupId,
    user_id: null,
    nickname,
    member_type: "guest",
  }));
  const members = [captain, ...guests];
  const group = {
    _id: groupId,
    name,
    created_by: String(user.id),
    mode,
    status: "ACTIVE",
    expected_member_count: expectedMemberCount,
    activated_at: now,
    settlement_completed_at: null,
    member_ids: members.map((member) => member._id),
    created_at: now,
  };

  await transaction(async (session) => {
    await db.collection("expense_group").insertOne(group, { session });
    await db.collection("group_member").insertMany(members, { session });
  });

  return mapGroup(group, members, []);
}

export function requireActiveGroup(viewer) {
  if (viewer.group.settlement_completed_at) {
    fail(409, "완료된 정산의 영수증은 변경할 수 없어요.");
  }

  if (viewer.group.status !== "ACTIVE") {
    fail(409, "모임이 시작된 뒤 영수증을 등록할 수 있어요.");
  }

  if (!viewer.member) {
    fail(403, "참여자 정보가 없어 영수증을 저장할 수 없어요.");
  }
}

function assertReceiptEditor(receipt, viewer, action) {
  const isUploader =
    String(receipt.uploaded_by_member_id) === String(viewer.member?._id);

  if (!viewer.isCaptain && !isUploader) {
    fail(403, `본인이 등록한 영수증만 ${action}할 수 있어요.`);
  }
}

function normalizeReceipt(input, members, currentReceipt, viewerMemberId) {
  const memberIds = new Set(members.map((member) => String(member._id)));
  const paidByMemberId = String(input?.paid_by_member_id ?? "");

  if (!memberIds.has(paidByMemberId)) {
    fail(400, "실제 결제자를 모임 참여자 중에서 선택해 주세요.");
  }

  if (!Array.isArray(input?.items) || input.items.length === 0) {
    fail(400, "메뉴를 한 개 이상 입력해 주세요.");
  }

  if (input.items.length > 100) {
    fail(400, "메뉴는 최대 100개까지 저장할 수 있어요.");
  }

  const currentItemIds = new Set(
    (currentReceipt?.items ?? []).map((item) => String(item._id)),
  );
  const usedItemIds = new Set();
  const items = input.items.map((item, index) => {
    const quantity = Number(item?.quantity);
    const unitPrice = Number(item?.unit_price ?? item?.amount);

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      fail(400, `${index + 1}번 메뉴 수량을 확인해 주세요.`);
    }

    if (!Number.isSafeInteger(unitPrice) || unitPrice < 1) {
      fail(400, `${index + 1}번 메뉴의 개당 금액을 확인해 주세요.`);
    }

    const lineTotal = quantity * unitPrice;

    if (!Number.isSafeInteger(lineTotal)) {
      fail(400, `${index + 1}번 메뉴 금액이 너무 커요.`);
    }

    const consumerMemberIds = [
      ...new Set(
        (Array.isArray(item?.consumer_member_ids)
          ? item.consumer_member_ids
          : []
        ).map(String),
      ),
    ];

    if (
      consumerMemberIds.length === 0 ||
      consumerMemberIds.some((memberId) => !memberIds.has(memberId))
    ) {
      fail(400, `${index + 1}번 메뉴를 먹은 사람을 선택해 주세요.`);
    }

    const requestedItemId = String(item?.id ?? item?._id ?? "");
    const itemId =
      currentItemIds.has(requestedItemId) && !usedItemIds.has(requestedItemId)
        ? requestedItemId
        : randomUUID();
    usedItemIds.add(itemId);

    return {
      _id: itemId,
      menu_name: cleanText(item?.menu_name ?? item?.name, "메뉴 이름", 80),
      quantity,
      unit_price: unitPrice,
      line_total: lineTotal,
      consumer_member_ids: consumerMemberIds,
    };
  });
  const totalAmount = items.reduce((total, item) => total + item.line_total, 0);

  if (!Number.isSafeInteger(totalAmount)) {
    fail(400, "영수증 전체 금액이 너무 커요.");
  }

  const now = new Date();
  const requestedInputMethod = String(input?.input_method ?? "MANUAL");

  if (
    !currentReceipt &&
    !["MANUAL", "CAMERA", "UPLOAD"].includes(requestedInputMethod)
  ) {
    fail(400, "영수증 등록 방식을 확인해 주세요.");
  }

  const inputMethod = currentReceipt?.input_method ?? requestedInputMethod;
  const imageKey =
    currentReceipt?.image_key ??
    (inputMethod === "MANUAL" ? null : input?.image_key);
  const ocrStatus =
    currentReceipt?.ocr_status ??
    (inputMethod === "MANUAL" ? "NONE" : input?.ocr_status);

  if (
    !currentReceipt &&
    inputMethod !== "MANUAL" &&
    (ocrStatus !== "COMPLETED" ||
      !isReceiptImageKeyForGroup(imageKey, members[0].group_id))
  ) {
    fail(400, "분석이 완료된 영수증 사진 정보가 필요해요.");
  }

  return {
    _id: currentReceipt?._id ?? randomUUID(),
    group_id: members[0].group_id,
    store_name: cleanText(input?.store_name ?? input?.title, "영수증 소제목", 100),
    total_amount: totalAmount,
    paid_by_member_id: paidByMemberId,
    uploaded_by_member_id:
      currentReceipt?.uploaded_by_member_id ?? String(viewerMemberId),
    participant_member_ids: [
      ...new Set(items.flatMap((item) => item.consumer_member_ids)),
    ],
    items,
    image_key: imageKey,
    input_method: inputMethod,
    ocr_status: ocrStatus,
    status: currentReceipt?.status ?? "ACTIVE",
    created_at: currentReceipt?.created_at ?? now,
    updated_at: now,
  };
}

function createPayments(receipt, previousPayments) {
  const statusByShare = new Map(
    previousPayments.map((payment) => [
      `${payment.expense_item_id}:${payment.payer_member_id}:${payment.payee_member_id}`,
      payment.status,
    ]),
  );

  return receipt.items.flatMap((item) =>
    item.consumer_member_ids.map((payerMemberId) => ({
      _id: randomUUID(),
      group_id: receipt.group_id,
      receipt_id: receipt._id,
      expense_item_id: item._id,
      payer_member_id: payerMemberId,
      payee_member_id: receipt.paid_by_member_id,
      status:
        payerMemberId === receipt.paid_by_member_id
          ? "paid"
          : (statusByShare.get(
              `${item._id}:${payerMemberId}:${receipt.paid_by_member_id}`,
            ) ?? "unpaid"),
      created_at: new Date(),
    })),
  );
}

export async function saveReceipt(groupId, credentials, input) {
  const viewer = await getGroupViewer(groupId, credentials);
  requireActiveGroup(viewer);

  const receiptId = input?.id ?? input?._id;
  const [members, currentReceipt] = await Promise.all([
    db.collection("group_member").find({ group_id: viewer.group._id }).toArray(),
    receiptId
      ? db.collection("receipts").findOne({
          _id: { $in: idVariants(receiptId) },
          group_id: viewer.group._id,
        })
      : null,
  ]);

  if (receiptId && !currentReceipt) {
    fail(404, "수정할 영수증을 찾을 수 없어요.");
  }

  if (currentReceipt) {
    assertReceiptEditor(currentReceipt, viewer, "수정");
  }

  const receipt = normalizeReceipt(
    input,
    members,
    currentReceipt,
    viewer.member._id,
  );

  if (
    !currentReceipt &&
    receipt.image_key &&
    !(await receiptImageExists(receipt.image_key, viewer.group._id))
  ) {
    fail(400, "저장된 영수증 사진을 찾을 수 없어요. 다시 분석해 주세요.");
  }
  const previousPayments = currentReceipt
    ? await db.collection("payment").find({
        group_id: viewer.group._id,
        receipt_id: currentReceipt._id,
      }).toArray()
    : [];
  const payments = createPayments(receipt, previousPayments);

  await transaction(async (session) => {
    await db.collection("receipts").replaceOne(
      { _id: receipt._id, group_id: viewer.group._id },
      receipt,
      { upsert: true, session },
    );
    await db.collection("payment").deleteMany(
      { group_id: viewer.group._id, receipt_id: receipt._id },
      { session },
    );

    if (payments.length > 0) {
      await db.collection("payment").insertMany(payments, { session });
    }
  });

  return String(receipt._id);
}

export async function deleteReceipt(groupId, receiptId, credentials) {
  const viewer = await getGroupViewer(groupId, credentials);
  requireActiveGroup(viewer);
  const receipt = await db.collection("receipts").findOne({
    _id: { $in: idVariants(receiptId) },
    group_id: viewer.group._id,
  });

  if (!receipt) fail(404, "삭제할 영수증을 찾을 수 없어요.");
  assertReceiptEditor(receipt, viewer, "삭제");

  await transaction(async (session) => {
    await db.collection("receipts").deleteOne(
      { _id: receipt._id, group_id: viewer.group._id },
      { session },
    );
    await db.collection("payment").deleteMany(
      { group_id: viewer.group._id, receipt_id: receipt._id },
      { session },
    );
  });

  if (receipt.image_key) {
    removeReceiptImage(receipt.image_key, viewer.group._id).catch((error) => {
      console.error("영수증 이미지 파일을 삭제하지 못했어요.", error);
    });
  }
}

export async function completeGroup(groupId, userId) {
  await connectDb();
  const result = await db.collection("expense_group").updateOne(
    {
      _id: { $in: idVariants(groupId) },
      created_by: { $in: idVariants(userId) },
      status: "ACTIVE",
      settlement_completed_at: null,
    },
    { $set: { settlement_completed_at: new Date() } },
  );

  if (!result.modifiedCount) {
    fail(409, "이미 완료되었거나 완료할 수 없는 정산이에요.");
  }

  return getGroup(groupId, userId);
}

export function groupErrorResponse(error) {
  const status = Number(error?.status) || 500;

  if (status === 500) console.error(error);

  return Response.json(
    {
      message:
        status === 500
          ? "처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요."
          : error.message,
    },
    { status },
  );
}
