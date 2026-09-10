const RECEIPT_METHODS = [
  {
    id: "manual",
    label: "직접 입력",
    description: "영수증과 메뉴 정보를 직접 입력해요.",
  },
  {
    id: "camera",
    label: "촬영하기",
    description: "카메라로 영수증을 바로 촬영해요.",
  },
  {
    id: "upload",
    label: "사진 첨부",
    description: "기기에 저장된 영수증 사진을 선택해요.",
  },
];

function createId(prefix) {
  const value =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${prefix}-${value}`;
}

function createMenuDraft(memberIds, sourceItem = null) {
  const quantity = Number(sourceItem?.quantity ?? 1);
  const lineTotal = Number(sourceItem?.line_total ?? sourceItem?.amount);
  const unitPrice =
    sourceItem?.unit_price ??
    (Number.isFinite(lineTotal) && quantity > 0 ? lineTotal / quantity : "");

  return {
    id: sourceItem?.id ?? createId("menu-draft"),
    name: sourceItem?.name ?? sourceItem?.menu_name ?? "",
    quantity: String(quantity),
    amount: String(unitPrice),
    consumer_member_ids: sourceItem?.consumer_member_ids
      ? [...sourceItem.consumer_member_ids]
      : [...memberIds],
  };
}

function formatWon(amount) {
  return `${Number(amount).toLocaleString("ko-KR")}원`;
}

function findMember(group, memberId) {
  return group.members.find((member) => member.id === memberId);
}

function getMemberNames(group, memberIds = []) {
  return memberIds
    .map((memberId) => findMember(group, memberId)?.nickname)
    .filter(Boolean);
}

function calculateItemShares(item) {
  const lineTotal = Number(item.line_total ?? item.amount);
  const memberIds = [...new Set(item.consumer_member_ids ?? [])];

  if (!Number.isSafeInteger(lineTotal) || lineTotal < 0 || memberIds.length === 0) {
    return [];
  }

  const baseAmount = Math.floor(lineTotal / memberIds.length);
  const remainder = lineTotal % memberIds.length;

  return memberIds.map((memberId, index) => ({
    memberId,
    amount: baseAmount + (index < remainder ? 1 : 0),
  }));
}

function calculateReceiptShares(receipt) {
  const memberTotals = new Map(
    (receipt.participant_member_ids ?? []).map((memberId) => [memberId, 0]),
  );
  const itemShares = new Map();

  for (const item of receipt.items ?? []) {
    const shares = calculateItemShares(item);
    itemShares.set(item.id, shares);

    for (const share of shares) {
      memberTotals.set(
        share.memberId,
        (memberTotals.get(share.memberId) ?? 0) + share.amount,
      );
    }
  }

  return {
    itemShares,
    memberTotals: [...memberTotals].map(([memberId, amount]) => ({
      memberId,
      amount,
    })),
  };
}

// 운영 DB 전환 후에도 이 계산 결과는 화면 미리보기에 사용할 수 있다.
// 정산 완료 시에는 서버에서도 같은 계산과 금액 검증을 다시 수행한 뒤 저장한다.
export function calculateGroupSettlement(group, receipts) {
  const totalsByMember = new Map(
    group.members.map((member) => [
      member.id,
      {
        memberId: member.id,
        paidAmount: 0,
        owedAmount: 0,
      },
    ]),
  );
  let totalAmount = 0;

  for (const receipt of receipts) {
    const receiptTotal = Number(receipt.total_amount);

    if (Number.isSafeInteger(receiptTotal) && receiptTotal >= 0) {
      totalAmount += receiptTotal;

      const payerTotal = totalsByMember.get(receipt.paid_by_member_id);

      if (payerTotal) {
        payerTotal.paidAmount += receiptTotal;
      }
    }

    const receiptShares = calculateReceiptShares(receipt);

    for (const share of receiptShares.memberTotals) {
      const memberTotal = totalsByMember.get(share.memberId);

      if (memberTotal) {
        memberTotal.owedAmount += share.amount;
      }
    }
  }

  return {
    totalAmount,
    memberTotals: [...totalsByMember.values()].map((memberTotal) => ({
      ...memberTotal,
      balance: memberTotal.paidAmount - memberTotal.owedAmount,
    })),
  };
}

function compareMemberIds(left, right) {
  if (left.memberId < right.memberId) {
    return -1;
  }

  if (left.memberId > right.memberId) {
    return 1;
  }

  return 0;
}

function calculateSettlementTransfers(memberTotals) {
  const debtors = memberTotals
    .filter((memberTotal) => memberTotal.balance < 0)
    .map((memberTotal) => ({
      memberId: memberTotal.memberId,
      remainingAmount: Math.abs(memberTotal.balance),
    }))
    .sort(compareMemberIds);
  const creditors = memberTotals
    .filter((memberTotal) => memberTotal.balance > 0)
    .map((memberTotal) => ({
      memberId: memberTotal.memberId,
      remainingAmount: memberTotal.balance,
    }))
    .sort(compareMemberIds);
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

    if (amount > 0 && debtor.memberId !== creditor.memberId) {
      transfers.push({
        id: `transfer-${debtor.memberId}-${creditor.memberId}`,
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

  return transfers;
}


export {
  RECEIPT_METHODS,
  calculateReceiptShares,
  calculateSettlementTransfers,
  createId,
  createMenuDraft,
  findMember,
  formatWon,
};
