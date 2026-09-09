const PAYMENT_STATUS = new Set(["paid", "unpaid"]);
const STORED_PAYMENT_AMOUNT_FIELDS = [
  "amount",
  "allocated_amount",
  "share_amount",
];

function assertUniqueIds(documents, label) {
  const ids = documents.map((document) => document._id);

  if (ids.some((id) => typeof id !== "string" || id.length === 0)) {
    throw new Error(`${label} IDs must be non-empty strings.`);
  }

  if (new Set(ids).size !== ids.length) {
    throw new Error(`${label} IDs must be unique.`);
  }
}

function assertMemberReference(memberId, groupId, membersById, fieldName) {
  const member = membersById.get(memberId);

  if (!member || member.group_id !== groupId) {
    throw new Error(`${fieldName} must reference a member in the same group.`);
  }

  return member;
}

function createPaymentKey(receiptId, itemId, payerMemberId) {
  return JSON.stringify([receiptId, itemId, payerMemberId]);
}

function validateSeedDocuments(seedDocuments, validatePersistedGroupState) {
  const { expenseGroups, groupMembers, receipts, payments } = seedDocuments;

  assertUniqueIds(expenseGroups, "expense_group");
  assertUniqueIds(groupMembers, "group_member");
  assertUniqueIds(receipts, "receipts");
  assertUniqueIds(payments, "payment");

  const groupsById = new Map(
    expenseGroups.map((group) => [group._id, group]),
  );
  const membersById = new Map(
    groupMembers.map((member) => [member._id, member]),
  );
  const receiptsById = new Map(receipts.map((receipt) => [receipt._id, receipt]));
  const itemsById = new Map();
  const expectedPaymentKeys = new Set();

  for (const group of expenseGroups) {
    if (group.mode === "shared") {
      throw new Error('Seed groups must not contain mode: "shared".');
    }

    if (Object.hasOwn(group, "member_ids")) {
      throw new Error("Seed groups must not contain member_ids[].");
    }

    if (typeof group.created_by !== "string" || group.created_by.length === 0) {
      throw new Error("created_by must be a non-empty string.");
    }

    const members = groupMembers.filter(
      (member) => member.group_id === group._id,
    );
    const ownerMembers = members.filter(
      (member) =>
        member.member_type === "registered" &&
        member.user_id === group.created_by,
    );

    if (ownerMembers.length !== 1) {
      throw new Error(
        `Seed group ${group._id} must have exactly one registered owner.`,
      );
    }

    validatePersistedGroupState({
      mode: group.mode,
      status: group.status,
      expectedMemberCount: group.expected_member_count,
      joinedMemberCount: members.length,
      activatedAt: group.activated_at,
    });
  }

  for (const member of groupMembers) {
    if (!groupsById.has(member.group_id)) {
      throw new Error("Every group_member must reference a seed group.");
    }

    if (member.member_type === "registered") {
      if (typeof member.user_id !== "string" || member.user_id.length === 0) {
        throw new Error("A registered member must have a string user_id.");
      }
    } else if (member.member_type === "guest") {
      if (member.user_id !== null) {
        throw new Error("A guest member must have user_id: null.");
      }
    } else {
      throw new Error('member_type must be "registered" or "guest".');
    }
  }

  for (const receipt of receipts) {
    if (!groupsById.has(receipt.group_id)) {
      throw new Error("Every receipt must reference a seed group.");
    }

    assertMemberReference(
      receipt.paid_by_member_id,
      receipt.group_id,
      membersById,
      "paid_by_member_id",
    );
    assertMemberReference(
      receipt.uploaded_by_member_id,
      receipt.group_id,
      membersById,
      "uploaded_by_member_id",
    );

    let calculatedReceiptTotal = 0;

    for (const item of receipt.items) {
      if (itemsById.has(item._id)) {
        throw new Error("Receipt item IDs must be unique across the Seed.");
      }

      if (
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        !Number.isFinite(item.unit_price) ||
        item.unit_price < 0 ||
        item.quantity * item.unit_price !== item.line_total
      ) {
        throw new Error("Every receipt item must have a valid line_total.");
      }

      if (
        !Array.isArray(item.consumer_member_ids) ||
        item.consumer_member_ids.length === 0 ||
        new Set(item.consumer_member_ids).size !==
          item.consumer_member_ids.length
      ) {
        throw new Error("Every receipt item needs unique consumer members.");
      }

      for (const consumerMemberId of item.consumer_member_ids) {
        assertMemberReference(
          consumerMemberId,
          receipt.group_id,
          membersById,
          "consumer_member_ids[]",
        );
        expectedPaymentKeys.add(
          createPaymentKey(receipt._id, item._id, consumerMemberId),
        );
      }

      itemsById.set(item._id, { item, receipt });
      calculatedReceiptTotal += item.line_total;
    }

    if (calculatedReceiptTotal !== receipt.total_amount) {
      throw new Error("Receipt item totals must equal total_amount.");
    }
  }

  const seenPaymentKeys = new Set();

  for (const payment of payments) {
    const receipt = receiptsById.get(payment.receipt_id);
    const indexedItem = itemsById.get(payment.expense_item_id);

    if (
      !receipt ||
      receipt.group_id !== payment.group_id ||
      !indexedItem ||
      indexedItem.receipt._id !== receipt._id
    ) {
      throw new Error("Every payment must reference its group, receipt, and item.");
    }

    assertMemberReference(
      payment.payer_member_id,
      payment.group_id,
      membersById,
      "payer_member_id",
    );
    assertMemberReference(
      payment.payee_member_id,
      payment.group_id,
      membersById,
      "payee_member_id",
    );

    if (!indexedItem.item.consumer_member_ids.includes(payment.payer_member_id)) {
      throw new Error("A payment payer must be an item consumer.");
    }

    if (payment.payee_member_id !== receipt.paid_by_member_id) {
      throw new Error("A payment payee must be the receipt payer.");
    }

    if (!PAYMENT_STATUS.has(payment.status)) {
      throw new Error('Payment status must be "paid" or "unpaid".');
    }

    if (
      STORED_PAYMENT_AMOUNT_FIELDS.some((field) =>
        Object.hasOwn(payment, field),
      )
    ) {
      throw new Error("Payment must not store a calculated share amount.");
    }

    const paymentKey = createPaymentKey(
      payment.receipt_id,
      payment.expense_item_id,
      payment.payer_member_id,
    );

    if (!expectedPaymentKeys.has(paymentKey) || seenPaymentKeys.has(paymentKey)) {
      throw new Error("Payments must match item consumers exactly once.");
    }

    seenPaymentKeys.add(paymentKey);
  }

  if (seenPaymentKeys.size !== expectedPaymentKeys.size) {
    throw new Error("Every item consumer must have exactly one payment.");
  }

  return true;
}

module.exports = {
  validateSeedDocuments,
};
