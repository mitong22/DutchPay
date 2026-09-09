import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";

import { client, connectDb, db } from "./db.js";
import { GUEST_COOKIE_MAX_AGE } from "./guest-session.mjs";
import {
  canCompleteSettlement,
  isSettlementCompleted,
  isWaitingGroup,
} from "./group-state.mjs";

const INVITE_LIFETIME = 1000 * 60 * 60 * 24 * 7;
const GUEST_SESSION_LIFETIME = 1000 * GUEST_COOKIE_MAX_AGE;

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function cleanText(value, label, maxLength = 80) {
  const text = String(value ?? "").trim();
  if (!text) fail(400, `${label}을(를) 입력해 주세요.`);
  if (text.length > maxLength) {
    fail(400, `${label}은(는) ${maxLength}자 이하여야 합니다.`);
  }
  return text;
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function newToken() {
  return randomBytes(32).toString("base64url");
}

function jsonValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function idVariants(value) {
  const id = String(value);
  return ObjectId.isValid(id) ? [id, ObjectId.createFromHexString(id)] : [id];
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

function inviteRecord(groupId) {
  const token = newToken();
  const now = new Date();
  return {
    token,
    document: {
      _id: randomUUID(),
      group_id: groupId,
      token_hash: hashToken(token),
      used_at: null,
      used_by_member_id: null,
      revoked_at: null,
      created_at: now,
      expires_at: new Date(now.getTime() + INVITE_LIFETIME),
    },
  };
}

export async function listGroups(userId) {
  const id = String(userId);
  const memberships = await db
    .collection("group_member")
    .find({ user_id: { $in: idVariants(id) } }, { projection: { group_id: 1 } })
    .toArray();
  const memberGroupIds = memberships.map((row) => row.group_id);
  const groups = await db
    .collection("expense_group")
    .find({
      $or: [
        { created_by: { $in: idVariants(id) } },
        { _id: { $in: memberGroupIds } },
      ],
    })
    .sort({ created_at: -1 })
    .toArray();

  return jsonValue(groups);
}

export async function createGroup(user, input) {
  const mode = input?.mode;
  if (!['SOLO', 'TOGETHER'].includes(mode)) {
    fail(400, "정산 방식을 선택해 주세요.");
  }

  const name = cleanText(input.name, "모임 이름");
  const hostId = randomUUID();
  const groupId = randomUUID();
  const now = new Date();
  const host = {
    _id: hostId,
    group_id: groupId,
    user_id: String(user.id),
    nickname: cleanText(user.name || user.email, "닉네임", 40),
    member_type: "registered",
  };
  let guests = [];
  let expectedMemberCount = 1;

  if (mode === "SOLO") {
    const names = Array.isArray(input.guestNames) ? input.guestNames : [];
    const uniqueNames = [...new Set(names.map((value) => String(value).trim()))]
      .filter(Boolean)
      .slice(0, 49);
    guests = uniqueNames.map((nickname) => ({
      _id: randomUUID(),
      group_id: groupId,
      user_id: null,
      nickname: cleanText(nickname, "참여자 이름", 40),
      member_type: "guest",
    }));
    expectedMemberCount = guests.length + 1;
  } else {
    expectedMemberCount = Number(input.expectedMemberCount);
    if (
      !Number.isInteger(expectedMemberCount) ||
      expectedMemberCount < 2 ||
      expectedMemberCount > 50
    ) {
      fail(400, "전체 인원은 2명 이상 50명 이하로 입력해 주세요.");
    }
  }

  const members = [host, ...guests];
  const invites = mode === "TOGETHER"
    ? Array.from({ length: expectedMemberCount - 1 }, () => inviteRecord(groupId))
    : [];
  const group = {
    _id: groupId,
    name,
    created_by: String(user.id),
    mode,
    status: mode === "SOLO" ? "ACTIVE" : "WAITING",
    expected_member_count: expectedMemberCount,
    activated_at: mode === "SOLO" ? now : null,
    settlement_completed_at: null,
    member_ids: members.map((member) => member._id),
    created_at: now,
  };

  await transaction(async (session) => {
    await db.collection("expense_group").insertOne(group, { session });
    await db.collection("group_member").insertMany(members, { session });
    if (invites.length) {
      await db.collection("group_invite").insertMany(
        invites.map((invite) => invite.document),
        { session },
      );
    }
  });

  return { groupId, inviteTokens: invites.map((invite) => invite.token) };
}

export async function getGroupViewer(groupId, credentials) {
  const group = await db.collection("expense_group").findOne({ _id: groupId });
  if (!group) fail(404, "모임을 찾을 수 없습니다.");

  if (credentials.userId) {
    const userId = String(credentials.userId);
    const member = await db.collection("group_member").findOne({
      group_id: groupId,
      user_id: { $in: idVariants(userId) },
    });
    const isHost = String(group.created_by) === userId;
    if (!member && !isHost) fail(403, "이 모임에 접근할 수 없습니다.");
    return { group, member, isHost, kind: "user" };
  }

  if (credentials.guestToken) {
    const guestSession = await db.collection("guest_session").findOne({
      group_id: groupId,
      token_hash: hashToken(credentials.guestToken),
      expires_at: { $gt: new Date() },
    });
    if (guestSession) {
      const member = await db.collection("group_member").findOne({
        _id: guestSession.member_id,
        group_id: groupId,
      });
      if (member) return { group, member, isHost: false, kind: "guest" };
    }
  }

  fail(401, "로그인하거나 유효한 초대 링크로 참여해 주세요.");
}

export async function getGroupBoard(groupId, credentials) {
  const viewer = await getGroupViewer(groupId, credentials);
  const members = await db
    .collection("group_member")
    .find({ group_id: groupId })
    .toArray();
  const waiting = isWaitingGroup(viewer.group);
  const [receipts, payments] = waiting
    ? [[], []]
    : await Promise.all([
        db
          .collection("receipts")
          .find({ group_id: groupId })
          .sort({ created_at: -1 })
          .toArray(),
        db.collection("payment").find({ group_id: groupId }).toArray(),
      ]);

  return jsonValue({
    group: viewer.group,
    members,
    receipts,
    payments,
    viewer: {
      memberId: viewer.member?._id ?? null,
      nickname: viewer.member?.nickname ?? "관리자",
      isHost: viewer.isHost,
      kind: viewer.kind,
    },
  });
}

export function requireActiveGroup(viewer) {
  if (isSettlementCompleted(viewer.group)) {
    fail(409, "완료된 정산은 변경할 수 없습니다.");
  }
  if (viewer.group.status !== "ACTIVE") {
    fail(409, "모든 참여자가 들어온 뒤 모임을 시작할 수 있어요.");
  }
}

export async function getInvitePreview(token) {
  if (!token || token.length > 200) return null;
  const invite = await db.collection("group_invite").findOne({
    token_hash: hashToken(token),
    used_at: null,
    revoked_at: null,
    expires_at: { $gt: new Date() },
  });
  if (!invite) return null;

  const group = await db
    .collection("expense_group")
    .findOne({ _id: invite.group_id });
  if (!group || group.mode !== "TOGETHER" || isSettlementCompleted(group)) {
    return null;
  }

  const joinedCount = await db
    .collection("group_member")
    .countDocuments({ group_id: group._id });

  return jsonValue({
    groupId: group._id,
    groupName: group.name,
    joinedCount,
    expectedMemberCount: group.expected_member_count,
    isFull: joinedCount >= group.expected_member_count,
    expiresAt: invite.expires_at,
  });
}

export async function joinGroup(token, nicknameValue, userId) {
  return transaction(async (session) => {
    const now = new Date();
    const invite = await db.collection("group_invite").findOne(
      {
        token_hash: hashToken(token),
        used_at: null,
        revoked_at: null,
        expires_at: { $gt: now },
      },
      { session },
    );
    if (!invite) fail(410, "초대 링크가 만료되었거나 유효하지 않습니다.");

    const group = await db
      .collection("expense_group")
      .findOne({ _id: invite.group_id, mode: "TOGETHER" }, { session });
    if (!group) fail(404, "모임을 찾을 수 없습니다.");
    if (isSettlementCompleted(group)) fail(410, "이미 완료된 정산입니다.");

    const members = await db
      .collection("group_member")
      .find({ group_id: group._id }, { session })
      .toArray();
    if (
      userId &&
      members.some(
        (member) => member.user_id && String(member.user_id) === String(userId),
      )
    ) {
      return { groupId: group._id, guestToken: null };
    }

    const nickname = cleanText(nicknameValue, "닉네임", 40);
    if (members.length >= group.expected_member_count) {
      fail(409, "이미 모든 인원이 참여했습니다.");
    }
    if (
      members.some(
        (member) => member.nickname.toLowerCase() === nickname.toLowerCase(),
      )
    ) {
      fail(409, "이미 사용 중인 닉네임입니다.");
    }

    const guestToken = userId ? null : newToken();
    const member = {
      _id: randomUUID(),
      group_id: group._id,
      user_id: userId ? String(userId) : null,
      nickname,
      member_type: userId ? "registered" : "guest",
    };
    const nextCount = members.length + 1;
    const isActive = nextCount >= group.expected_member_count;

    const claimed = await db.collection("group_invite").updateOne(
      { _id: invite._id, used_at: null, revoked_at: null },
      { $set: { used_at: now, used_by_member_id: member._id } },
      { session },
    );
    if (!claimed.modifiedCount) fail(410, "이미 사용된 초대 링크입니다.");

    await db.collection("group_member").insertOne(member, { session });
    await db.collection("expense_group").updateOne(
      { _id: group._id },
      {
        $push: { member_ids: member._id },
        $set: {
          status: isActive ? "ACTIVE" : "WAITING",
          activated_at: isActive ? (group.activated_at ?? now) : null,
        },
      },
      { session },
    );
    if (guestToken) {
      await db.collection("guest_session").insertOne(
        {
          _id: randomUUID(),
          group_id: group._id,
          member_id: member._id,
          token_hash: hashToken(guestToken),
          created_at: now,
          expires_at: new Date(now.getTime() + GUEST_SESSION_LIFETIME),
        },
        { session },
      );
    }

    return { groupId: group._id, guestToken };
  });
}

function assertReceiptOwner(receipt, viewer, action) {
  if (
    !viewer.member ||
    String(receipt.uploaded_by_member_id) !== String(viewer.member._id)
  ) {
    fail(403, `본인이 등록한 영수증만 ${action}할 수 있습니다.`);
  }
}

function normalizeReceipt(input, members, currentReceipt, viewerMemberId) {
  const memberIds = new Set(members.map((member) => member._id));
  const paidByMemberId = String(viewerMemberId);
  if (!memberIds.has(paidByMemberId)) {
    fail(403, "본인 명의로만 영수증을 등록할 수 있습니다.");
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    fail(400, "메뉴를 하나 이상 입력해 주세요.");
  }
  if (input.items.length > 100) fail(400, "메뉴는 최대 100개까지 저장할 수 있습니다.");

  const items = input.items.map((item) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unit_price);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      fail(400, "수량은 1 이상 999 이하의 정수여야 합니다.");
    }
    if (!Number.isSafeInteger(unitPrice) || unitPrice < 0) {
      fail(400, "단가는 0 이상의 원 단위 정수여야 합니다.");
    }
    const lineTotal = quantity * unitPrice;
    if (!Number.isSafeInteger(lineTotal)) fail(400, "메뉴 금액이 너무 큽니다.");

    const consumers = [
      ...new Set(
        (Array.isArray(item.consumer_member_ids)
          ? item.consumer_member_ids
          : []
        ).map(String),
      ),
    ];
    if (consumers.length === 0 || consumers.some((id) => !memberIds.has(id))) {
      fail(400, "각 메뉴의 참여자를 한 명 이상 선택해 주세요.");
    }

    return {
      _id: item._id ? String(item._id) : randomUUID(),
      menu_name: cleanText(item.menu_name, "메뉴 이름", 80),
      quantity,
      unit_price: unitPrice,
      line_total: lineTotal,
      consumer_member_ids: consumers,
    };
  });
  const totalAmount = items.reduce((sum, item) => sum + item.line_total, 0);
  if (!Number.isSafeInteger(totalAmount)) fail(400, "영수증 금액이 너무 큽니다.");

  const now = new Date();
  return {
    _id: currentReceipt?._id ?? randomUUID(),
    group_id: members[0]?.group_id,
    store_name: cleanText(input.store_name, "가게 이름", 100),
    total_amount: totalAmount,
    paid_by_member_id: paidByMemberId,
    uploaded_by_member_id: viewerMemberId,
    items,
    created_at: currentReceipt?.created_at ?? now,
    updated_at: now,
  };
}

export async function saveReceipt(groupId, input, viewer) {
  if (!viewer.member) fail(403, "참여자 정보가 없어 영수증을 저장할 수 없습니다.");
  const [members, currentReceipt] = await Promise.all([
    db.collection("group_member").find({ group_id: groupId }).toArray(),
    input._id
      ? db.collection("receipts").findOne({
          _id: String(input._id),
          group_id: groupId,
        })
      : null,
  ]);
  if (input._id && !currentReceipt) fail(404, "수정할 영수증을 찾을 수 없습니다.");
  if (currentReceipt) assertReceiptOwner(currentReceipt, viewer, "수정");

  const receipt = normalizeReceipt(
    input,
    members,
    currentReceipt,
    viewer.member._id,
  );
  const existingPayments = currentReceipt
    ? await db
        .collection("payment")
        .find({ group_id: groupId, receipt_id: receipt._id })
        .toArray()
    : [];
  const statusByShare = new Map(
    existingPayments.map((payment) => [
      `${payment.expense_item_id}:${payment.payer_member_id}:${payment.payee_member_id}`,
      payment.status,
    ]),
  );
  const payments = receipt.items.flatMap((item) =>
    item.consumer_member_ids.map((payerMemberId) => ({
      _id: randomUUID(),
      group_id: groupId,
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

  await transaction(async (session) => {
    await db.collection("receipts").replaceOne(
      { _id: receipt._id, group_id: groupId },
      receipt,
      { upsert: true, session },
    );
    await db
      .collection("payment")
      .deleteMany({ group_id: groupId, receipt_id: receipt._id }, { session });
    if (payments.length) {
      await db.collection("payment").insertMany(payments, { session });
    }
  });

  return receipt._id;
}

export async function deleteReceipt(groupId, receiptId, viewer) {
  const receipt = await db.collection("receipts").findOne({
    _id: String(receiptId),
    group_id: groupId,
  });
  if (!receipt) fail(404, "삭제할 영수증을 찾을 수 없습니다.");
  assertReceiptOwner(receipt, viewer, "삭제");

  await transaction(async (session) => {
    await db.collection("receipts").deleteOne({ _id: receipt._id }, { session });
    await db.collection("payment").deleteMany(
      { group_id: groupId, receipt_id: receipt._id },
      { session },
    );
  });
}

export async function setPaymentStatus(groupId, paymentId, status, viewer) {
  if (!["paid", "unpaid"].includes(status)) fail(400, "잘못된 결제 상태입니다.");
  const payment = await db.collection("payment").findOne({
    _id: String(paymentId),
    group_id: groupId,
  });
  if (!payment) fail(404, "결제 상태를 찾을 수 없습니다.");
  if (!viewer.isHost && payment.payer_member_id !== viewer.member?._id) {
    fail(403, "본인의 결제 상태만 바꿀 수 있습니다.");
  }
  if (payment.payer_member_id === payment.payee_member_id && status === "unpaid") {
    fail(400, "직접 결제한 항목은 미결제로 바꿀 수 없습니다.");
  }

  await db.collection("payment").updateOne(
    { _id: payment._id, group_id: groupId },
    { $set: { status, updated_at: new Date() } },
  );
}

export async function completeSettlement(groupId, viewer) {
  if (!viewer.isHost) fail(403, "총대만 정산을 완료할 수 있습니다.");
  if (!canCompleteSettlement(viewer.group, viewer)) {
    fail(409, "진행 중인 정산만 완료할 수 있습니다.");
  }

  const result = await db.collection("expense_group").updateOne(
    { _id: groupId, status: "ACTIVE", settlement_completed_at: null },
    { $set: { settlement_completed_at: new Date() } },
  );
  if (!result.modifiedCount) fail(409, "이미 완료되었거나 상태가 변경된 정산입니다.");
}

export async function createInvites(groupId, viewer) {
  if (!viewer.isHost) fail(403, "총대만 초대 링크를 만들 수 있습니다.");
  if (viewer.group.mode !== "TOGETHER") {
    fail(400, "함께하기 모임에서만 초대 링크를 만들 수 있습니다.");
  }

  return transaction(async (session) => {
    const group = await db.collection("expense_group").findOne(
      { _id: groupId },
      { session },
    );
    if (!group || !isWaitingGroup(group) || isSettlementCompleted(group)) {
      fail(409, "참여자를 기다리는 모임에서만 초대할 수 있습니다.");
    }

    const joinedCount = await db.collection("group_member").countDocuments(
      { group_id: groupId },
      { session },
    );
    const remainingCount = group.expected_member_count - joinedCount;
    if (remainingCount < 1) fail(409, "이미 모든 인원이 참여했습니다.");

    const now = new Date();
    const invites = Array.from(
      { length: remainingCount },
      () => inviteRecord(groupId),
    );
    await db.collection("group_invite").updateMany(
      { group_id: groupId, used_at: null, revoked_at: null },
      { $set: { revoked_at: now } },
      { session },
    );
    await db.collection("group_invite").insertMany(
      invites.map((invite) => invite.document),
      { session },
    );
    return invites.map((invite) => invite.token);
  });
}

export function errorResponse(error) {
  const status = Number(error?.status) || 500;
  if (status === 500) console.error(error);
  return Response.json(
    {
      error:
        status === 500 ? "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." : error.message,
    },
    { status },
  );
}
