function stringId(value) {
  return value == null ? null : String(value);
}

function dateString(value) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapMember(member) {
  return {
    id: stringId(member._id),
    user_id: stringId(member.user_id),
    nickname: member.nickname,
    member_type: member.member_type,
  };
}

// Teacher: DB 필드명을 id·title·name 등으로 바꾸고 같은 의미의 별칭도 함께 만듭니다. 수업의 원본 문서 전달 방식과 비교하여 Client에서 꼭 필요한 변환만 골라 보고, 메뉴 참여자의 합집합과 영수증 참여자가 항상 같은지 확인해 보기.
function mapReceipt(receipt) {
  const items = (receipt.items ?? []).map((item) => ({
    id: stringId(item._id),
    name: item.menu_name,
    menu_name: item.menu_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    amount: item.line_total,
    line_total: item.line_total,
    consumer_member_ids: (item.consumer_member_ids ?? []).map(stringId),
  }));
  const participantMemberIds = [
    ...new Set(items.flatMap((item) => item.consumer_member_ids)),
  ];

  return {
    id: stringId(receipt._id),
    group_id: stringId(receipt.group_id),
    title: receipt.store_name,
    store_name: receipt.store_name,
    total_amount: receipt.total_amount,
    paid_by_member_id: stringId(receipt.paid_by_member_id),
    uploaded_by_member_id: stringId(receipt.uploaded_by_member_id),
    participant_member_ids: participantMemberIds,
    items,
    image_key: receipt.image_key ?? null,
    input_method: receipt.input_method ?? "MANUAL",
    ocr_status: receipt.ocr_status ?? "NONE",
    status: receipt.status ?? "ACTIVE",
    created_at: dateString(receipt.created_at),
    updated_at: dateString(receipt.updated_at),
  };
}

export function mapGroup(group, members = [], receipts = []) {
  const memberOrder = new Map(
    (group.member_ids ?? []).map((memberId, index) => [
      stringId(memberId),
      index,
    ]),
  );
  const orderedMembers = [...members].sort(
    (left, right) =>
      (memberOrder.get(stringId(left._id)) ?? Number.MAX_SAFE_INTEGER) -
      (memberOrder.get(stringId(right._id)) ?? Number.MAX_SAFE_INTEGER),
  );
  const completedAt = dateString(group.settlement_completed_at);

  return {
    id: stringId(group._id),
    name: group.name,
    created_by: stringId(group.created_by),
    mode: group.mode,
    status: completedAt ? "COMPLETED" : group.status,
    expected_member_count: group.expected_member_count,
    created_at: dateString(group.created_at),
    activated_at: dateString(group.activated_at),
    completed_at: completedAt,
    calculation_version: group.calculation_version ?? 1,
    members: orderedMembers.map(mapMember),
    receipts: receipts.map(mapReceipt),
  };
}
