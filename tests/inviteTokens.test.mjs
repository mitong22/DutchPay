import assert from "node:assert/strict";
import test from "node:test";

import {
  createInviteToken,
  guestCookieName,
  hashInviteToken,
} from "../lib/inviteTokens.mjs";

test("초대 토큰 원문 대신 같은 해시값을 저장한다", () => {
  const token = createInviteToken();
  const tokenHash = hashInviteToken(token);

  assert.notEqual(tokenHash, token);
  assert.equal(tokenHash, hashInviteToken(token));
  assert.equal(tokenHash.length, 64);
});

test("비회원 쿠키는 모임마다 다른 이름을 사용한다", () => {
  assert.equal(guestCookieName("group-a"), "dutchpay_guest_group-a");
  assert.notEqual(guestCookieName("group-a"), guestCookieName("group-b"));
});
