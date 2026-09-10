const RECEIPT_STORE_EVENT = "dutchpay-receipt-store-change";
const EMPTY_RECEIPTS_SNAPSHOT = "[]";
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

function getReceiptStoreKey(groupId) {
  return `dutchpay:receipts:${groupId}`;
}

function getReceiptsSnapshot(groupId) {
  try {
    return (
      window.localStorage.getItem(getReceiptStoreKey(groupId)) ??
      EMPTY_RECEIPTS_SNAPSHOT
    );
  } catch {
    return EMPTY_RECEIPTS_SNAPSHOT;
  }
}

function getServerReceiptsSnapshot() {
  return EMPTY_RECEIPTS_SNAPSHOT;
}

function subscribeToReceipts(callback) {
  window.addEventListener("storage", callback);
  window.addEventListener(RECEIPT_STORE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(RECEIPT_STORE_EVENT, callback);
  };
}

function parseReceipts(snapshot) {
  try {
    const receipts = JSON.parse(snapshot);
    return Array.isArray(receipts) ? receipts : [];
  } catch {
    return [];
  }
}

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

function writeReceipts(groupId, receipts) {
  try {
    window.localStorage.setItem(
      getReceiptStoreKey(groupId),
      JSON.stringify(receipts),
    );
    window.dispatchEvent(new Event(RECEIPT_STORE_EVENT));
    return true;
  } catch {
    return false;
  }
}

function appendReceipt(groupId, receipt) {
  const currentReceipts = parseReceipts(getReceiptsSnapshot(groupId));
  return writeReceipts(groupId, [...currentReceipts, receipt]);
}

function replaceReceipt(groupId, receipt) {
  const currentReceipts = parseReceipts(getReceiptsSnapshot(groupId));
  const nextReceipts = currentReceipts.map((currentReceipt) =>
    currentReceipt.id === receipt.id ? receipt : currentReceipt,
  );

  return writeReceipts(groupId, nextReceipts);
}

function removeReceipt(groupId, receiptId) {
  const currentReceipts = parseReceipts(getReceiptsSnapshot(groupId));
  const nextReceipts = currentReceipts.filter(
    (receipt) => receipt.id !== receiptId,
  );

  return writeReceipts(groupId, nextReceipts);
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
  appendReceipt,
  calculateReceiptShares,
  calculateSettlementTransfers,
  createId,
  createMenuDraft,
  findMember,
  formatWon,
  getReceiptsSnapshot,
  getServerReceiptsSnapshot,
  parseReceipts,
  removeReceipt,
  replaceReceipt,
  subscribeToReceipts,
};
