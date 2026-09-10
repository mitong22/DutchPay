import assert from "node:assert/strict";
import test from "node:test";

import { isValidMockLogin } from "../lib/mockSession.mjs";

test("테스트 계정 자격 증명이 정확히 일치할 때만 로그인된다", () => {
  assert.equal(isValidMockLogin("1234", "1234"), true);
  assert.equal(isValidMockLogin("1234", "wrong"), false);
  assert.equal(isValidMockLogin("", ""), false);
});
