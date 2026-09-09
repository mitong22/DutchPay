export function splitAmount(amount, memberIds) {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error("금액은 0 이상의 정수여야 합니다.");
  }

  const ids = [...new Set(memberIds)];
  if (ids.length === 0) throw new Error("메뉴 참여자가 필요합니다.");

  const base = Math.floor(amount / ids.length);
  const remainder = amount % ids.length;

  // ponytail: 원 단위 정책 확정 전에는 선택 순서 앞사람부터 1원씩 배분한다.
  return ids.map((memberId, index) => ({
    memberId,
    amount: base + (index < remainder ? 1 : 0),
  }));
}

export function receiptsForMember(receipts, memberId) {
  return receipts.filter((receipt) => receipt.paid_by_member_id === memberId);
}

export function calculateSettlement(receipts, members) {
  const totals = new Map(
    members.map((member) => [member._id, { ...member, paid: 0, owes: 0 }]),
  );

  for (const receipt of receipts) {
    const payer = totals.get(receipt.paid_by_member_id);
    if (payer) payer.paid += receipt.total_amount;

    for (const item of receipt.items ?? []) {
      for (const share of splitAmount(
        item.line_total,
        item.consumer_member_ids,
      )) {
        const consumer = totals.get(share.memberId);
        if (consumer) consumer.owes += share.amount;
      }
    }
  }

  const rows = [...totals.values()].map((row) => ({
    ...row,
    balance: row.paid - row.owes,
  }));
  const creditors = rows
    .filter((row) => row.balance > 0)
    .map((row) => ({ ...row }))
    .sort((a, b) => b.balance - a.balance);
  const debtors = rows
    .filter((row) => row.balance < 0)
    .map((row) => ({ ...row, debt: -row.balance }))
    .sort((a, b) => b.debt - a.debt);
  const transfers = [];

  let creditorIndex = 0;
  let debtorIndex = 0;
  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = Math.min(creditor.balance, debtor.debt);

    transfers.push({
      fromMemberId: debtor._id,
      toMemberId: creditor._id,
      amount,
    });
    creditor.balance -= amount;
    debtor.debt -= amount;
    if (creditor.balance === 0) creditorIndex += 1;
    if (debtor.debt === 0) debtorIndex += 1;
  }

  return { rows, transfers };
}

export function paymentAmount(payment, receipts) {
  const receipt = receipts.find((row) => row._id === payment.receipt_id);
  const item = receipt?.items?.find(
    (row) => row._id === payment.expense_item_id,
  );
  if (!item) return 0;

  return (
    splitAmount(item.line_total, item.consumer_member_ids).find(
      (share) => share.memberId === payment.payer_member_id,
    )?.amount ?? 0
  );
}
