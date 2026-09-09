import assert from "node:assert/strict";
import test from "node:test";
import { guestCookieName, getGuestToken } from "../lib/guest-session.mjs";

test("게스트는 두 모임의 접속 정보를 별도로 유지하고 기존 쿠키도 읽는다", () => {
  const jar = new Map([["dutchpay_guest", "legacy-token"]]);
  const cookies = { get: (name) => jar.has(name) ? { value: jar.get(name) } : undefined };
  assert.equal(getGuestToken(cookies, "old-group"), "legacy-token");
  jar.set(guestCookieName("group-a"), "token-a");
  jar.set(guestCookieName("group-b"), "token-b");
  assert.notEqual(guestCookieName("group-a"), guestCookieName("group-b"));
  assert.equal(getGuestToken(cookies, "group-a"), "token-a");
  assert.equal(getGuestToken(cookies, "group-b"), "token-b");
  assert.equal(getGuestToken(cookies, "old-group"), "legacy-token");
  jar.delete("dutchpay_guest");
  assert.equal(getGuestToken(cookies, "unknown-group"), undefined);
});
