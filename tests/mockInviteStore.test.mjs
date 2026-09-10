import assert from "node:assert/strict";
import test from "node:test";

import {
  createMockInvite,
  findMockInviteMember,
  joinMockInvite,
} from "../lib/mockInviteStore.mjs";

test("로그인 총대와 같은 비회원 세션을 새 사람으로 만들지 않는다", () => {
  const invite = createMockInvite({
    captain: { id: "captain-1", userId: "user-1", nickname: "미연" },
    expectedMemberCount: 3,
    groupName: "초대 테스트",
  });

  assert.equal(
    findMockInviteMember(invite, { userId: "user-1" }).id,
    "captain-1",
  );

  const firstJoin = joinMockInvite(
    invite,
    { guestId: "guest-browser-1" },
    "지현",
  );
  const secondJoin = joinMockInvite(
    invite,
    { guestId: "guest-browser-1" },
    "다른 이름",
  );

  assert.equal(firstJoin.created, true);
  assert.equal(secondJoin.created, false);
  assert.equal(secondJoin.member.id, firstJoin.member.id);
  assert.equal(invite.participants.length, 1);
});
