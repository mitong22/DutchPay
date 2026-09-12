// Teacher: participant_member_ids가 없는 과거 영수증만 메뉴 참여자의 합집합으로 보완하는 호환 코드입니다. DB를 수정하지는 않으며, 참석했지만 아무 메뉴도 먹지 않은 사람은 이 방식으로 복원할 수 없습니다. 단순 필드명 변경용 map과 이런 기존 데이터 호환 처리가 왜 다른지 실제 문서로 비교해 보세요.
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
