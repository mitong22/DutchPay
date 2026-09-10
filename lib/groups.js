import "server-only";

import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";

import { client, connectDb, db } from "./db.js";
import { mapGroup } from "./groupMapper.mjs";

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
      $or: [
        { created_by: { $in: userIds } },
        { _id: { $in: memberships.map((member) => member.group_id) } },
      ],
    })
    .sort({ created_at: -1 })
    .toArray();

  return attachGroupData(groups);
}

export async function getGroup(groupId, userId) {
  await connectDb();
  const group = await db.collection("expense_group").findOne({
    _id: { $in: idVariants(groupId) },
  });

  if (!group) return null;

  const isCaptain = String(group.created_by) === String(userId);
  const isMember = await db.collection("group_member").findOne({
    group_id: group._id,
    user_id: { $in: idVariants(userId) },
  });

  if (!isCaptain && !isMember) return null;

  return (await attachGroupData([group]))[0];
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
