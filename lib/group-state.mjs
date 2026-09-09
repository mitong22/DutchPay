export function isWaitingGroup(group) {
  return group.mode === "TOGETHER" && group.status === "WAITING";
}

export function isSettlementCompleted(group) {
  return Boolean(group.settlement_completed_at);
}

export function canCompleteSettlement(group, viewer) {
  return group.status === "ACTIVE" && !isSettlementCompleted(group) && viewer.isHost;
}
