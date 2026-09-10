// ponytail: 프로세스 메모리 목업이다. 재시작 후 유지가 필요해지면 invite/guest_session 컬렉션으로 교체한다.
const invites = new Map();

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createMockInvite({ captain, expectedMemberCount, groupName }) {
  const invite = {
    token: createId("invite"),
    groupName,
    expectedMemberCount,
    status: "WAITING",
    captain: {
      id: captain.id,
      userId: captain.userId,
      nickname: captain.nickname,
      memberType: "registered",
    },
    participants: [],
  };

  invites.set(invite.token, invite);
  return invite;
}

export function getMockInvite(token) {
  return invites.get(token) ?? null;
}

export function findMockInviteMember(invite, { guestId, userId }) {
  if (userId && invite.captain.userId === userId) {
    return invite.captain;
  }

  return (
    invite.participants.find(
      (member) =>
        (userId && member.userId === userId) ||
        (guestId && member.guestId === guestId),
    ) ?? null
  );
}

export function joinMockInvite(invite, identity, nickname) {
  const existingMember = findMockInviteMember(invite, identity);

  if (existingMember) {
    return { created: false, member: existingMember };
  }

  if (invite.status !== "WAITING") {
    return { error: "CLOSED" };
  }

  if (invite.participants.length + 1 >= invite.expectedMemberCount) {
    return { error: "FULL" };
  }

  const comparableNickname = nickname.toLowerCase();
  const isDuplicate = [invite.captain, ...invite.participants].some(
    (member) => member.nickname.toLowerCase() === comparableNickname,
  );

  if (isDuplicate) {
    return { error: "DUPLICATE_NICKNAME" };
  }

  const member = {
    id: createId("mock-member"),
    userId: identity.userId ?? null,
    guestId: identity.userId ? null : identity.guestId,
    nickname,
    memberType: identity.userId ? "registered" : "guest",
  };

  invite.participants.push(member);
  return { created: true, member };
}

export function removeMockInviteParticipant(invite, memberId) {
  const previousCount = invite.participants.length;
  invite.participants = invite.participants.filter(
    (member) => member.id !== memberId,
  );
  return invite.participants.length !== previousCount;
}

export function completeMockInvite(invite) {
  invite.status = "ACTIVE";
}

export function createMockGuestId() {
  return createId("guest-session");
}
