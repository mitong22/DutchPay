import { cookies } from "next/headers";

import {
  completeMockInvite,
  createMockGuestId,
  createMockInvite,
  findMockInviteMember,
  getMockInvite,
  joinMockInvite,
  removeMockInviteParticipant,
} from "@/lib/mockInviteStore.mjs";
import { MOCK_ACCOUNT_COOKIE } from "@/lib/mockSession.mjs";

const GUEST_SESSION_COOKIE = "dutchpay_guest_session";
const COOKIE_OPTIONS = {
  httpOnly: true,
  maxAge: 60 * 60 * 24 * 30,
  path: "/",
  sameSite: "lax",
};

function publicMember(member) {
  return {
    id: member.id,
    nickname: member.nickname,
    memberType: member.memberType,
  };
}

function publicInvite(invite, currentMember = null) {
  return {
    token: invite.token,
    groupName: invite.groupName,
    expectedMemberCount: invite.expectedMemberCount,
    status: invite.status,
    captain: publicMember(invite.captain),
    participants: invite.participants.map(publicMember),
    currentMember: currentMember ? publicMember(currentMember) : null,
  };
}

function errorResponse(message, status) {
  return Response.json({ message }, { status });
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function getRequestInvite(request) {
  const body = await readBody(request);
  const token = typeof body?.token === "string" ? body.token : "";

  return { body, invite: getMockInvite(token) };
}

// 운영 DB 전환 위치:
// POST=초대 insertOne, GET=토큰 findOne, PATCH=참여자 조건부 updateOne,
// DELETE=참여자 제거 updateOne, PUT=모임 상태 updateOne으로 교체한다.
// captain 값도 요청 body를 신뢰하지 않고 Better Auth 세션과 DB에서 가져온다.
export async function POST(request) {
  const body = await readBody(request);
  const groupName = typeof body?.groupName === "string" ? body.groupName.trim() : "";
  const expectedMemberCount = Number(body?.expectedMemberCount);
  const captain = body?.captain;

  if (
    !groupName ||
    !Number.isInteger(expectedMemberCount) ||
    expectedMemberCount < 2 ||
    expectedMemberCount > 8 ||
    typeof captain?.id !== "string" ||
    typeof captain?.userId !== "string" ||
    typeof captain?.nickname !== "string"
  ) {
    return errorResponse("초대 정보를 확인해 주세요.", 400);
  }

  const cookieStore = await cookies();

  if (cookieStore.get(MOCK_ACCOUNT_COOKIE)?.value !== captain.userId) {
    return errorResponse("로그인한 총대만 초대 링크를 만들 수 있어요.", 401);
  }

  const invite = createMockInvite({ captain, expectedMemberCount, groupName });

  return Response.json({ invite: publicInvite(invite) }, { status: 201 });
}

export async function GET(request) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const invite = getMockInvite(token);

  if (!invite) {
    return errorResponse("유효하지 않거나 만료된 초대 링크예요.", 404);
  }

  const cookieStore = await cookies();
  const currentMember = findMockInviteMember(invite, {
    userId: cookieStore.get(MOCK_ACCOUNT_COOKIE)?.value,
    guestId: cookieStore.get(GUEST_SESSION_COOKIE)?.value,
  });

  return Response.json({ invite: publicInvite(invite, currentMember) });
}

export async function PATCH(request) {
  const { body, invite } = await getRequestInvite(request);

  if (!invite) {
    return errorResponse("유효하지 않거나 만료된 초대 링크예요.", 404);
  }

  const nickname = typeof body?.nickname === "string" ? body.nickname.trim() : "";

  if (!nickname || nickname.length > 20) {
    return errorResponse("사용할 별명을 입력해 주세요.", 400);
  }

  const cookieStore = await cookies();
  const userId = cookieStore.get(MOCK_ACCOUNT_COOKIE)?.value;
  const storedGuestId = cookieStore.get(GUEST_SESSION_COOKIE)?.value;
  const guestId = storedGuestId ?? createMockGuestId();
  const result = joinMockInvite(invite, { guestId, userId }, nickname);

  if (result.error === "CLOSED") {
    return errorResponse("이미 시작된 모임이에요.", 409);
  }

  if (result.error === "FULL") {
    return errorResponse("예정된 인원이 모두 참여했어요.", 409);
  }

  if (result.error === "DUPLICATE_NICKNAME") {
    return errorResponse("이미 사용 중인 별명이에요.", 409);
  }

  if (!userId && !storedGuestId) {
    cookieStore.set(GUEST_SESSION_COOKIE, guestId, COOKIE_OPTIONS);
  }

  return Response.json({
    invite: publicInvite(invite, result.member),
    created: result.created,
  });
}

export async function DELETE(request) {
  const { body, invite } = await getRequestInvite(request);

  if (!invite) {
    return errorResponse("유효하지 않거나 만료된 초대 링크예요.", 404);
  }

  const cookieStore = await cookies();

  if (cookieStore.get(MOCK_ACCOUNT_COOKIE)?.value !== invite.captain.userId) {
    return errorResponse("총대만 참여자를 관리할 수 있어요.", 403);
  }

  if (!removeMockInviteParticipant(invite, body?.memberId)) {
    return errorResponse("참여자를 찾을 수 없어요.", 404);
  }

  return Response.json({ invite: publicInvite(invite, invite.captain) });
}

export async function PUT(request) {
  const { invite } = await getRequestInvite(request);

  if (!invite) {
    return errorResponse("유효하지 않거나 만료된 초대 링크예요.", 404);
  }

  const cookieStore = await cookies();

  if (cookieStore.get(MOCK_ACCOUNT_COOKIE)?.value !== invite.captain.userId) {
    return errorResponse("총대만 모임을 시작할 수 있어요.", 403);
  }

  completeMockInvite(invite);
  return Response.json({ invite: publicInvite(invite, invite.captain) });
}
