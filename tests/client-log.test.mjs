import assert from "node:assert/strict";
import test from "node:test";

import { redactClientLog } from "../lib/client-log.mjs";

test("클라이언트 로그에서 초대 링크와 비밀값을 숨긴다", () => {
  assert.equal(
    redactClientLog("/invite/real-token?token=secret password=hunter2"),
    "/invite/[redacted]?token=[redacted] password=[redacted]",
  );
});
