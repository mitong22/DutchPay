const INVITE_STATUS = new Set(["ACTIVE", "REVOKED", "EXPIRED"]);
const PAYMENT_STATUS = new Set(["paid", "unpaid"]);
const STORED_PAYMENT_AMOUNT_FIELDS = [
  "amount",
  "allocated_amount",
  "share_amount",
];
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_HASH_PATTERN = /^[0-9a-f]{64}$/;

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${fieldName} must be a non-empty string.`);
  }

  return value;
}

function assertUuid(value, fieldName) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new TypeError(`${fieldName} must be a UUID string.`);
  }

  return value;
}

function assertValidDate(value, fieldName) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(`${fieldName} must be a valid Date.`);
  }

  return value;
}

function assertUniqueIds(documents, label) {
  if (!Array.isArray(documents)) {
    throw new TypeError(`${label} documents must be an array.`);
  }

  const ids = documents.map((document) => {
    assertUuid(document._id, `${label}._id`);
    return document._id;
  });

  if (new Set(ids).size !== ids.length) {
    throw new Error(`${label} IDs must be unique.`);
  }
}

function assertUniqueMemberIds(memberIds, fieldName, allowEmpty = false) {
  if (!Array.isArray(memberIds)) {
    throw new TypeError(`${fieldName} must be an array.`);
  }

  if (!allowEmpty && memberIds.length === 0) {
    throw new Error(`${fieldName} must contain at least one member.`);
  }

  for (const memberId of memberIds) {
    assertUuid(memberId, fieldName);
  }

  if (new Set(memberIds).size !== memberIds.length) {
    throw new Error(`${fieldName} must not contain duplicate members.`);
  }

  return memberIds;
}

function assertSeedMetadata(document, label) {
  if (
    document.seed_metadata?.namespace !== "dutchpay-development" ||
    !Number.isSafeInteger(document.seed_metadata?.version) ||
    document.seed_metadata.version < 1
  ) {
    throw new Error(`${label} must contain valid seed_metadata.`);
  }
}

function assertTokenHash(document, label, seenTokenHashes) {
  if (!TOKEN_HASH_PATTERN.test(document.token_hash)) {
    throw new Error(`${label}.token_hash must be a SHA-256 hex string.`);
  }

  if (
    Object.hasOwn(document, "token") ||
    Object.hasOwn(document, "raw_token")
  ) {
    throw new Error(`${label} must not store a raw token.`);
  }

  if (seenTokenHashes.has(document.token_hash)) {
    throw new Error(`${label}.token_hash must be unique.`);
  }

  seenTokenHashes.add(document.token_hash);
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

async function validateSeedDocuments(seedDocuments) {
  const [groupRules, settlementRules] = await Promise.all([
    import("../lib/group-rules.mjs"),
    import("../lib/settlement-rules.mjs"),
  ]);
  const { validatePersistedGroupState } = groupRules;
  const { assertSettlementAmount, calculateItemShares } = settlementRules;
  const {
    expenseGroups,
    groupMembers,
    receipts,
    payments,
    invites,
    guestSessions,
  } = seedDocuments;

  assertUniqueIds(expenseGroups, "expense_group");
  assertUniqueIds(groupMembers, "group_member");
  assertUniqueIds(receipts, "receipts");
  assertUniqueIds(payments, "payment");
  assertUniqueIds(invites, "invite");
  assertUniqueIds(guestSessions, "guest_session");

  const groupsById = new Map(
    expenseGroups.map((group) => [group._id, group]),
  );
  const membersById = new Map(
    groupMembers.map((member) => [member._id, member]),
  );
  const receiptsById = new Map(receipts.map((receipt) => [receipt._id, receipt]));
  const invitesById = new Map(invites.map((invite) => [invite._id, invite]));
  const itemsById = new Map();
  const expectedPaymentKeys = new Set();

  for (const group of expenseGroups) {
    assertSeedMetadata(group, "expense_group");
    assertNonEmptyString(group.name, "expense_group.name");
    assertNonEmptyString(group.created_by, "expense_group.created_by");
    assertValidDate(group.created_at, "expense_group.created_at");
    assertValidDate(group.updated_at, "expense_group.updated_at");

    if (group.updated_at < group.created_at) {
      throw new Error("expense_group.updated_at cannot precede created_at.");
    }

    if (group.mode === "shared") {
      throw new Error('Seed groups must not contain mode: "shared".');
    }

    if (Object.hasOwn(group, "member_ids")) {
      throw new Error("Seed groups must not contain member_ids[].");
    }

    const members = groupMembers.filter(
      (member) => member.group_id === group._id,
    );
    const registeredMembers = members.filter(
      (member) => member.member_type === "registered",
    );

    if (
      registeredMembers.length !== 1 ||
      registeredMembers[0].user_id !== group.created_by
    ) {
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
    assertSeedMetadata(member, "group_member");
    assertUuid(member.group_id, "group_member.group_id");
    assertNonEmptyString(member.nickname, "group_member.nickname");

    if (!groupsById.has(member.group_id)) {
      throw new Error("Every group_member must reference a seed group.");
    }

    if (member.member_type === "registered") {
      assertNonEmptyString(member.user_id, "group_member.user_id");
    } else if (member.member_type === "guest") {
      if (member.user_id !== null) {
        throw new Error("A guest member must have user_id: null.");
      }
    } else {
      throw new Error('member_type must be "registered" or "guest".');
    }
  }

  for (const receipt of receipts) {
    assertSeedMetadata(receipt, "receipts");
    assertUuid(receipt.group_id, "receipts.group_id");
    assertNonEmptyString(receipt.store_name, "receipts.store_name");
    assertSettlementAmount(receipt.total_amount, "receipts.total_amount");

    if (!groupsById.has(receipt.group_id)) {
      throw new Error("Every receipt must reference a seed group.");
    }

    const participantMemberIds = assertUniqueMemberIds(
      receipt.participant_member_ids,
      "participant_member_ids[]",
    );
    const participantMemberIdSet = new Set(participantMemberIds);

    for (const participantMemberId of participantMemberIds) {
      assertMemberReference(
        participantMemberId,
        receipt.group_id,
        membersById,
        "participant_member_ids[]",
      );
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

    if (!Array.isArray(receipt.items) || receipt.items.length === 0) {
      throw new Error("Every receipt must contain at least one item.");
    }

    let calculatedReceiptTotal = 0;

    for (const item of receipt.items) {
      assertUuid(item._id, "receipts.items[]._id");
      assertNonEmptyString(item.menu_name, "receipts.items[].menu_name");

      if (itemsById.has(item._id)) {
        throw new Error("Receipt item IDs must be unique across the Seed.");
      }

      if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
        throw new Error("Every receipt item must have a positive integer quantity.");
      }

      assertSettlementAmount(item.unit_price, "receipts.items[].unit_price");
      assertSettlementAmount(item.line_total, "receipts.items[].line_total");

      const multipliedLineTotal = item.quantity * item.unit_price;

      if (
        !Number.isSafeInteger(multipliedLineTotal) ||
        multipliedLineTotal !== item.line_total
      ) {
        throw new Error("Every receipt item must have a valid line_total.");
      }

      const consumerMemberIds = assertUniqueMemberIds(
        item.consumer_member_ids,
        "consumer_member_ids[]",
      );

      for (const consumerMemberId of consumerMemberIds) {
        assertMemberReference(
          consumerMemberId,
          receipt.group_id,
          membersById,
          "consumer_member_ids[]",
        );

        if (!participantMemberIdSet.has(consumerMemberId)) {
          throw new Error(
            "Every item consumer must be a receipt participant.",
          );
        }

        expectedPaymentKeys.add(
          createPaymentKey(receipt._id, item._id, consumerMemberId),
        );
      }

      const itemShares = calculateItemShares({
        lineTotal: item.line_total,
        consumerMemberIds,
        remainderRecipientMemberIds: item.remainder_recipient_member_ids,
      });
      const calculatedItemTotal = itemShares.reduce(
        (total, share) => total + share.amount,
        0,
      );

      if (calculatedItemTotal !== item.line_total) {
        throw new Error("Item shares must add up to line_total.");
      }

      itemsById.set(item._id, { item, receipt });
      calculatedReceiptTotal += item.line_total;
    }

    if (!Number.isSafeInteger(calculatedReceiptTotal)) {
      throw new Error("Receipt item totals must remain a safe integer.");
    }

    if (calculatedReceiptTotal !== receipt.total_amount) {
      throw new Error("Receipt item totals must equal total_amount.");
    }
  }

  const seenPaymentKeys = new Set();

  for (const payment of payments) {
    assertSeedMetadata(payment, "payment");
    assertValidDate(payment.created_at, "payment.created_at");

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

  const inviteTokenHashes = new Set();
  const claimedMemberIds = new Set();

  for (const invite of invites) {
    assertSeedMetadata(invite, "invite");
    assertTokenHash(invite, "invite", inviteTokenHashes);
    assertValidDate(invite.created_at, "invite.created_at");
    assertValidDate(invite.expires_at, "invite.expires_at");

    const group = groupsById.get(invite.group_id);

    if (!group || group.mode !== "TOGETHER") {
      throw new Error("Every invite must reference a TOGETHER seed group.");
    }

    if (!INVITE_STATUS.has(invite.status)) {
      throw new Error("Invite status must be ACTIVE, REVOKED, or EXPIRED.");
    }

    if (invite.expires_at <= invite.created_at) {
      throw new Error("invite.expires_at must be later than created_at.");
    }

    if (invite.member_id === null) {
      if (invite.claimed_at !== null) {
        throw new Error("An unclaimed invite must have claimed_at: null.");
      }
    } else {
      const member = assertMemberReference(
        invite.member_id,
        invite.group_id,
        membersById,
        "invite.member_id",
      );
      assertValidDate(invite.claimed_at, "invite.claimed_at");

      if (member.member_type !== "guest") {
        throw new Error("An invite can claim only a guest member.");
      }

      if (invite.claimed_at < invite.created_at) {
        throw new Error("invite.claimed_at cannot precede created_at.");
      }

      if (claimedMemberIds.has(invite.member_id)) {
        throw new Error("A guest member can be claimed by only one invite.");
      }

      claimedMemberIds.add(invite.member_id);
    }
  }

  for (const group of expenseGroups) {
    const groupInvites = invites.filter(
      (invite) => invite.group_id === group._id,
    );

    if (group.mode === "SOLO" && groupInvites.length !== 0) {
      throw new Error("A SOLO group must not have invites.");
    }

    if (group.mode === "TOGETHER" && group.status === "WAITING") {
      const joinedMemberCount = groupMembers.filter(
        (member) => member.group_id === group._id,
      ).length;
      const openInviteCount = groupInvites.filter(
        (invite) => invite.status === "ACTIVE" && invite.member_id === null,
      ).length;

      if (
        openInviteCount !==
        group.expected_member_count - joinedMemberCount
      ) {
        throw new Error(
          "A WAITING TOGETHER group needs one active invite for every open member slot.",
        );
      }
    }
  }

  const guestSessionTokenHashes = new Set();

  for (const guestSession of guestSessions) {
    assertSeedMetadata(guestSession, "guest_session");
    assertTokenHash(
      guestSession,
      "guest_session",
      guestSessionTokenHashes,
    );
    assertValidDate(guestSession.created_at, "guest_session.created_at");
    assertValidDate(guestSession.expires_at, "guest_session.expires_at");

    const member = assertMemberReference(
      guestSession.member_id,
      guestSession.group_id,
      membersById,
      "guest_session.member_id",
    );

    if (member.member_type !== "guest") {
      throw new Error("A guest_session must reference a guest member.");
    }

    if (guestSession.expires_at <= guestSession.created_at) {
      throw new Error(
        "guest_session.expires_at must be later than created_at.",
      );
    }

    const claimedInvite = [...invitesById.values()].find(
      (invite) =>
        invite.group_id === guestSession.group_id &&
        invite.member_id === guestSession.member_id,
    );

    if (!claimedInvite) {
      throw new Error(
        "Every guest_session member must be linked to a claimed invite.",
      );
    }
  }

  return true;
}

module.exports = {
  validateSeedDocuments,
};
