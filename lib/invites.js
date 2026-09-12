import "server-only";

import { randomUUID } from "node:crypto";

import { client, connectDb, db } from "./db.js";
import {
  GUEST_COOKIE_MAX_AGE,
  createInviteToken,
  hashInviteToken,
} from "./inviteTokens.mjs";

const INVITE_MAX_AGE = 60 * 60 * 24 * 7;

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
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

async function loadInviteContext(token, session = null) {
  const normalizedToken = String(token ?? "");

  if (!normalizedToken || normalizedToken.length > 200) {
    fail(404, "유효하지 않거나 만료된 초대 링크예요.");
  }

  await connectDb();
  const invite = await db.collection("group_invite").findOne(
    {
      token_hash: hashInviteToken(normalizedToken),
      revoked_at: null,
      expires_at: { $gt: new Date() },
    },
    { session },
  );

  if (!invite) fail(404, "유효하지 않거나 만료된 초대 링크예요.");

  const [group, members] = await Promise.all([
    db.collection("expense_group").findOne(
      { _id: invite.group_id, mode: "TOGETHER" },
      { session },
    ),
    db.collection("group_member").find(
      { group_id: invite.group_id },
      { session },
    ).toArray(),
  ]);

  if (!group) fail(404, "초대된 모임을 찾을 수 없어요.");

  return { invite, group, members, token: normalizedToken };
}

async function findCurrentMember(context, credentials, session = null) {
  if (credentials?.userId) {
    return (
      context.members.find(
        (member) => String(member.user_id) === String(credentials.userId),
      ) ?? null
    );
  }

  // Teacher: 초대 링크 토큰과 참여한 사람의 guestToken은 역할이 다릅니다. 링크 → guest_session → member_id → group_member 순서를 그려 보고, 브라우저가 보낸 별명만으로 참여 권한을 판정하지 않는 이유를 설명해 보기.
  if (!credentials?.guestToken) return null;

  const guestSession = await db.collection("guest_session").findOne(
    {
      group_id: context.group._id,
      token_hash: hashInviteToken(credentials.guestToken),
      expires_at: { $gt: new Date() },
    },
    { session },
  );

  if (!guestSession) return null;

  return (
    context.members.find(
      (member) => String(member._id) === String(guestSession.member_id),
    ) ?? null
  );
}

function publicMember(member) {
  return {
    id: String(member._id),
    nickname: member.nickname,
    memberType: member.member_type,
  };
}

function publicInvite(context, currentMember = null) {
  const captain = context.members.find(
    (member) => String(member.user_id) === String(context.group.created_by),
  );

  if (!captain) fail(500, "총대 참여자 정보를 찾을 수 없어요.");

  return {
    token: context.token,
    groupId: String(context.group._id),
    groupName: context.group.name,
    expectedMemberCount: context.group.expected_member_count,
    status: context.group.status,
    captain: publicMember(captain),
    participants: context.members
      .filter((member) => String(member._id) !== String(captain._id))
      .map(publicMember),
    currentMember: currentMember ? publicMember(currentMember) : null,
  };
}

export async function createInvite(user, input) {
  const groupName = cleanText(input?.groupName, "모임 이름", 40);
  const expectedMemberCount = Number(input?.expectedMemberCount);

  if (
    !Number.isInteger(expectedMemberCount) ||
    expectedMemberCount < 2 ||
    expectedMemberCount > 8
  ) {
    fail(400, "참여 예정 인원은 2명 이상 8명 이하로 입력해 주세요.");
  }

  const groupId = randomUUID();
  const captainId = randomUUID();
  const token = createInviteToken();
  const now = new Date();
  const captain = {
    _id: captainId,
    group_id: groupId,
    user_id: String(user.id),
    nickname: cleanText(user.nickname, "총대 별명", 40),
    member_type: "registered",
  };
  const group = {
    _id: groupId,
    name: groupName,
    created_by: String(user.id),
    mode: "TOGETHER",
    status: "WAITING",
    expected_member_count: expectedMemberCount,
    activated_at: null,
    settlement_completed_at: null,
    member_ids: [captainId],
    created_at: now,
  };
  const invite = {
    _id: randomUUID(),
    group_id: groupId,
    token_hash: hashInviteToken(token),
    revoked_at: null,
    created_at: now,
    expires_at: new Date(now.getTime() + INVITE_MAX_AGE * 1000),
  };

  await transaction(async (session) => {
    await db.collection("expense_group").insertOne(group, { session });
    await db.collection("group_member").insertOne(captain, { session });
    await db.collection("group_invite").insertOne(invite, { session });
  });

  return publicInvite(
    { invite, group, members: [captain], token },
    captain,
  );
}

export async function getInviteGroupId(token) {
  const context = await loadInviteContext(token);
  return String(context.group._id);
}

export async function getInvite(token, credentials = {}) {
  const context = await loadInviteContext(token);
  const currentMember = await findCurrentMember(context, credentials);
  return publicInvite(context, currentMember);
}

export async function joinInvite(token, nicknameValue, credentials = {}) {
  const result = await transaction(async (session) => {
    const context = await loadInviteContext(token, session);
    const currentMember = await findCurrentMember(context, credentials, session);

    if (currentMember) {
      return {
        context,
        currentMember,
        created: false,
        guestToken: null,
      };
    }

    if (context.group.status !== "WAITING") {
      fail(409, "이미 시작된 모임이에요.");
    }

    if (context.members.length >= context.group.expected_member_count) {
      fail(409, "예정된 인원이 모두 참여했어요.");
    }

    const nickname = cleanText(nicknameValue, "사용할 별명", 20);
    const normalizedNickname = nickname.toLocaleLowerCase("ko-KR");

    if (
      context.members.some(
        (member) =>
          member.nickname.toLocaleLowerCase("ko-KR") === normalizedNickname,
      )
    ) {
      fail(409, "이미 사용 중인 별명이에요.");
    }

    const member = {
      _id: randomUUID(),
      group_id: context.group._id,
      user_id: credentials.userId ? String(credentials.userId) : null,
      nickname,
      member_type: credentials.userId ? "registered" : "guest",
    };
    const guestToken = credentials.userId ? null : createInviteToken();

    await db.collection("group_member").insertOne(member, { session });
    const groupUpdate = await db.collection("expense_group").updateOne(
      { _id: context.group._id, status: "WAITING" },
      { $push: { member_ids: member._id } },
      { session },
    );

    if (!groupUpdate.modifiedCount) {
      fail(409, "모임 상태가 이미 변경됐어요.");
    }
    await db.collection("group_invite").updateOne(
      { _id: context.invite._id, revoked_at: null },
      { $set: { last_joined_at: new Date() } },
      { session },
    );

    if (guestToken) {
      const now = new Date();
      await db.collection("guest_session").insertOne(
        {
          _id: randomUUID(),
          group_id: context.group._id,
          member_id: member._id,
          token_hash: hashInviteToken(guestToken),
          created_at: now,
          expires_at: new Date(now.getTime() + GUEST_COOKIE_MAX_AGE * 1000),
        },
        { session },
      );
    }

    context.members.push(member);
    return {
      context,
      currentMember: member,
      created: true,
      guestToken,
    };
  });

  return {
    invite: publicInvite(result.context, result.currentMember),
    created: result.created,
    guestToken: result.guestToken,
  };
}

export async function removeInviteParticipant(token, memberId, userId) {
  await transaction(async (session) => {
    const context = await loadInviteContext(token, session);

    if (String(context.group.created_by) !== String(userId)) {
      fail(403, "총대만 참여자를 관리할 수 있어요.");
    }

    if (context.group.status !== "WAITING") {
      fail(409, "모임을 시작한 뒤에는 참여자를 취소할 수 없어요.");
    }

    const participant = context.members.find(
      (member) =>
        String(member._id) === String(memberId) &&
        String(member.user_id) !== String(context.group.created_by),
    );

    if (!participant) fail(404, "참여자를 찾을 수 없어요.");

    await db.collection("guest_session").deleteMany(
      { group_id: context.group._id, member_id: participant._id },
      { session },
    );
    await db.collection("group_member").deleteOne(
      { _id: participant._id, group_id: context.group._id },
      { session },
    );
    await db.collection("expense_group").updateOne(
      { _id: context.group._id },
      { $pull: { member_ids: participant._id } },
      { session },
    );
  });

  return getInvite(token, { userId });
}

export async function activateInvite(token, userId) {
  await transaction(async (session) => {
    const context = await loadInviteContext(token, session);

    if (String(context.group.created_by) !== String(userId)) {
      fail(403, "총대만 모임을 시작할 수 있어요.");
    }

    if (context.group.status !== "WAITING") {
      fail(409, "이미 시작된 모임이에요.");
    }

    if (context.members.length !== context.group.expected_member_count) {
      fail(409, "예정된 참여자가 모두 입장해야 모임을 시작할 수 있어요.");
    }

    const result = await db.collection("expense_group").updateOne(
      { _id: context.group._id, status: "WAITING" },
      { $set: { status: "ACTIVE", activated_at: new Date() } },
      { session },
    );

    if (!result.modifiedCount) fail(409, "모임 상태가 이미 변경됐어요.");
  });

  return getInvite(token, { userId });
}
