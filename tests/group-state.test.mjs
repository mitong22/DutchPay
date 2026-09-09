import assert from "node:assert/strict";
import test from "node:test";

import {
  canCompleteSettlement,
  isSettlementCompleted,
  isWaitingGroup,
} from "../lib/group-state.mjs";

test("대기 상태와 총대의 정산 완료 권한을 구분한다", () => {
  assert.equal(isWaitingGroup({ mode: "TOGETHER", status: "WAITING" }), true);
  assert.equal(isWaitingGroup({ mode: "TOGETHER", status: "ACTIVE" }), false);
  assert.equal(isSettlementCompleted({ settlement_completed_at: null }), false);
  assert.equal(canCompleteSettlement({ status: "ACTIVE", settlement_completed_at: null }, { isHost: true }), true);
  assert.equal(canCompleteSettlement({ status: "ACTIVE", settlement_completed_at: null }, { isHost: false }), false);
  assert.equal(canCompleteSettlement({ status: "ACTIVE", settlement_completed_at: "2026-09-09" }, { isHost: true }), false);
});
