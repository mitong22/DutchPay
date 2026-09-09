export function normalizeReceiptForRead(receipt) {
  if (!receipt || Array.isArray(receipt.participant_member_ids)) {
    return receipt;
  }

  const participantMemberIds = [];
  const seenMemberIds = new Set();

  for (const item of receipt.items ?? []) {
    for (const memberId of item.consumer_member_ids ?? []) {
      if (!seenMemberIds.has(memberId)) {
        seenMemberIds.add(memberId);
        participantMemberIds.push(memberId);
      }
    }
  }

  return {
    ...receipt,
    participant_member_ids: participantMemberIds,
  };
}
