import { calculateItemShares } from "./settlement-rules.mjs";

function addSafeAmount(currentAmount, amount, fieldName) {
  const nextAmount = currentAmount + amount;

  if (!Number.isSafeInteger(nextAmount)) {
    throw new RangeError(`${fieldName} exceeds the safe integer range.`);
  }

  return nextAmount;
}

export function calculateReceiptItemShares(receipt) {
  return receipt.items.map((item) => ({
    itemId: item._id,
    shares: calculateItemShares({
      lineTotal: item.line_total,
      consumerMemberIds: item.consumer_member_ids,
      remainderRecipientMemberIds: item.remainder_recipient_member_ids,
    }),
  }));
}

export function calculateGroupSettlement({ members, receipts }) {
  const totalsByMemberId = new Map();

  for (const member of members) {
    if (totalsByMemberId.has(member._id)) {
      throw new Error("members must not contain duplicate IDs.");
    }

    totalsByMemberId.set(member._id, {
      memberId: member._id,
      paidAmount: 0,
      owedAmount: 0,
      balance: 0,
    });
  }

  for (const receipt of receipts) {
    const payerTotals = totalsByMemberId.get(receipt.paid_by_member_id);

    if (!payerTotals) {
      throw new Error("Every receipt payer must be a group member.");
    }

    payerTotals.paidAmount = addSafeAmount(
      payerTotals.paidAmount,
      receipt.total_amount,
      "paidAmount",
    );

    for (const item of receipt.items) {
      const shares = calculateItemShares({
        lineTotal: item.line_total,
        consumerMemberIds: item.consumer_member_ids,
        remainderRecipientMemberIds: item.remainder_recipient_member_ids,
      });

      for (const share of shares) {
        const consumerTotals = totalsByMemberId.get(share.memberId);

        if (!consumerTotals) {
          throw new Error("Every item consumer must be a group member.");
        }

        consumerTotals.owedAmount = addSafeAmount(
          consumerTotals.owedAmount,
          share.amount,
          "owedAmount",
        );
      }
    }
  }

  const memberTotals = [...totalsByMemberId.values()]
    .map((memberTotal) => ({
      ...memberTotal,
      balance: memberTotal.paidAmount - memberTotal.owedAmount,
    }))
    .sort((first, second) => first.memberId.localeCompare(second.memberId));
  const balanceTotal = memberTotals.reduce(
    (total, memberTotal) => total + memberTotal.balance,
    0,
  );

  if (balanceTotal !== 0) {
    throw new Error("The group settlement balance must equal zero.");
  }

  const debtors = memberTotals
    .filter((memberTotal) => memberTotal.balance < 0)
    .map((memberTotal) => ({
      memberId: memberTotal.memberId,
      remainingAmount: -memberTotal.balance,
    }));
  const creditors = memberTotals
    .filter((memberTotal) => memberTotal.balance > 0)
    .map((memberTotal) => ({
      memberId: memberTotal.memberId,
      remainingAmount: memberTotal.balance,
    }));
  const transfers = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(
      debtor.remainingAmount,
      creditor.remainingAmount,
    );

    if (debtor.memberId !== creditor.memberId && amount > 0) {
      transfers.push({
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        amount,
      });
    }

    debtor.remainingAmount -= amount;
    creditor.remainingAmount -= amount;

    if (debtor.remainingAmount === 0) {
      debtorIndex += 1;
    }

    if (creditor.remainingAmount === 0) {
      creditorIndex += 1;
    }
  }

  if (debtorIndex !== debtors.length || creditorIndex !== creditors.length) {
    throw new Error("Every settlement balance must be fully matched.");
  }

  return {
    memberTotals,
    transfers,
  };
}
