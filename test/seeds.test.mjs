import assert from "node:assert/strict";
import test from "node:test";

import { calculateItemShares } from "../lib/settlement-rules.mjs";
import validationModule from "../scripts/seed-data-validation.js";
import seedModule from "../scripts/seeds.js";

const {
  SEED_GROUP_IDS,
  SEED_MEMBER_IDS,
  buildSeedDocuments,
  createSeedPreview,
  getSeedWriteConfiguration,
  parseSeedCommand,
} = seedModule;
const { validateSeedDocuments } = validationModule;

function calculateGroupBalances(seedDocuments, groupId) {
  const balances = new Map(
    seedDocuments.groupMembers
      .filter((member) => member.group_id === groupId)
      .map((member) => [
        member._id,
        {
          nickname: member.nickname,
          paid: 0,
          owed: 0,
          balance: 0,
        },
      ]),
  );
  const receipts = seedDocuments.receipts.filter(
    (receipt) => receipt.group_id === groupId,
  );

  for (const receipt of receipts) {
    balances.get(receipt.paid_by_member_id).paid += receipt.total_amount;

    for (const item of receipt.items) {
      const itemShares = calculateItemShares({
        lineTotal: item.line_total,
        consumerMemberIds: item.consumer_member_ids,
        remainderRecipientMemberIds: item.remainder_recipient_member_ids,
      });

      for (const itemShare of itemShares) {
        balances.get(itemShare.memberId).owed += itemShare.amount;
      }
    }
  }

  for (const memberBalance of balances.values()) {
    memberBalance.balance = memberBalance.paid - memberBalance.owed;
  }

  return balances;
}

test("seed command accepts only preview or one explicit write argument", () => {
  assert.equal(parseSeedCommand([]), "--preview");
  assert.equal(parseSeedCommand(["--preview"]), "--preview");
  assert.equal(parseSeedCommand(["--write"]), "--write");
  assert.throws(() => parseSeedCommand(["--delete"]), /Use either/);
  assert.throws(
    () => parseSeedCommand(["--write", "--extra"]),
    /Use either/,
  );
});

test("seed data preserves Atlas fixtures and adds SOLO and multi-payer scenarios", async () => {
  const seedDocuments = await buildSeedDocuments("better-auth-owner-id");
  const waitingGroup = seedDocuments.expenseGroups.find(
    (group) => group._id === SEED_GROUP_IDS.TOGETHER_WAITING,
  );
  const migratedGroup = seedDocuments.expenseGroups.find(
    (group) => group._id === SEED_GROUP_IDS.TOGETHER_ACTIVE_FROM_SHARED,
  );
  const soloGroup = seedDocuments.expenseGroups.find(
    (group) => group._id === SEED_GROUP_IDS.SOLO_ACTIVE,
  );
  const multiPayerGroup = seedDocuments.expenseGroups.find(
    (group) => group._id === SEED_GROUP_IDS.TOGETHER_ACTIVE_MULTI_PAYER,
  );

  assert.deepEqual(
    [waitingGroup.mode, waitingGroup.status],
    ["TOGETHER", "WAITING"],
  );
  assert.deepEqual(
    [migratedGroup.mode, migratedGroup.status],
    ["TOGETHER", "ACTIVE"],
  );
  assert.deepEqual(
    [soloGroup.mode, soloGroup.status],
    ["SOLO", "ACTIVE"],
  );
  assert.deepEqual(
    [multiPayerGroup.mode, multiPayerGroup.status],
    ["TOGETHER", "ACTIVE"],
  );
  assert.equal(
    seedDocuments.expenseGroups.some((group) => group.mode === "shared"),
    false,
  );
  assert.deepEqual(
    {
      groups: seedDocuments.expenseGroups.length,
      members: seedDocuments.groupMembers.length,
      receipts: seedDocuments.receipts.length,
      items: seedDocuments.receipts.reduce(
        (count, receipt) => count + receipt.items.length,
        0,
      ),
      payments: seedDocuments.payments.length,
      invites: seedDocuments.invites.length,
      guestSessions: seedDocuments.guestSessions.length,
    },
    {
      groups: 4,
      members: 13,
      receipts: 6,
      items: 9,
      payments: 24,
      invites: 6,
      guestSessions: 3,
    },
  );
});

test("every seed group has exactly one registered owner and no member_ids array", async () => {
  const seedDocuments = await buildSeedDocuments("better-auth-owner-id");

  for (const group of seedDocuments.expenseGroups) {
    const groupMembers = seedDocuments.groupMembers.filter(
      (member) => member.group_id === group._id,
    );
    const registeredMembers = groupMembers.filter(
      (member) => member.member_type === "registered",
    );

    assert.equal(registeredMembers.length, 1);
    assert.equal(registeredMembers[0].user_id, "better-auth-owner-id");
    assert.equal(Object.hasOwn(group, "member_ids"), false);
  }
});

test("the migrated Atlas receipt keeps its amounts and participant relationships", async () => {
  const seedDocuments = await buildSeedDocuments("better-auth-owner-id");
  const receipt = seedDocuments.receipts.find(
    (candidate) =>
      candidate.group_id === SEED_GROUP_IDS.TOGETHER_ACTIVE_FROM_SHARED,
  );

  assert.equal(receipt.total_amount, 36000);
  assert.deepEqual(
    receipt.items.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unit_price,
      lineTotal: item.line_total,
      consumerCount: item.consumer_member_ids.length,
      remainderRecipientCount: item.remainder_recipient_member_ids.length,
    })),
    [
      {
        quantity: 2,
        unitPrice: 15000,
        lineTotal: 30000,
        consumerCount: 3,
        remainderRecipientCount: 0,
      },
      {
        quantity: 2,
        unitPrice: 3000,
        lineTotal: 6000,
        consumerCount: 2,
        remainderRecipientCount: 0,
      },
    ],
  );
  assert.deepEqual(
    new Set(receipt.participant_member_ids),
    new Set(receipt.items.flatMap((item) => item.consumer_member_ids)),
  );
});

test("SOLO receipts are always paid and uploaded by the registered owner", async () => {
  const seedDocuments = await buildSeedDocuments("better-auth-owner-id");
  const soloReceipts = seedDocuments.receipts.filter(
    (receipt) => receipt.group_id === SEED_GROUP_IDS.SOLO_ACTIVE,
  );

  assert.equal(soloReceipts.length, 2);

  for (const receipt of soloReceipts) {
    assert.equal(receipt.paid_by_member_id, SEED_MEMBER_IDS.SOLO_OWNER);
    assert.equal(receipt.uploaded_by_member_id, SEED_MEMBER_IDS.SOLO_OWNER);
  }

  assert.equal(
    seedDocuments.invites.some(
      (invite) => invite.group_id === SEED_GROUP_IDS.SOLO_ACTIVE,
    ),
    false,
  );

  const soloMealReceipt = soloReceipts.find(
    (receipt) => receipt.participant_member_ids.length === 4,
  );
  assert.equal(
    soloMealReceipt.items.some((item) =>
      item.consumer_member_ids.includes(SEED_MEMBER_IDS.SOLO_GUEST_3),
    ),
    false,
  );
});

test("TOGETHER multi-payer receipts cover different payers and uploaders", async () => {
  const seedDocuments = await buildSeedDocuments("better-auth-owner-id");
  const receipts = seedDocuments.receipts.filter(
    (receipt) =>
      receipt.group_id === SEED_GROUP_IDS.TOGETHER_ACTIVE_MULTI_PAYER,
  );

  assert.equal(receipts.length, 3);
  assert.equal(new Set(receipts.map((receipt) => receipt.paid_by_member_id)).size, 3);
  assert.equal(
    receipts.some(
      (receipt) =>
        receipt.paid_by_member_id !== receipt.uploaded_by_member_id,
    ),
    true,
  );
});

test("multi-payer balances include stable 10-won random remainder assignments", async () => {
  const seedDocuments = await buildSeedDocuments("better-auth-owner-id");
  const balances = calculateGroupBalances(
    seedDocuments,
    SEED_GROUP_IDS.TOGETHER_ACTIVE_MULTI_PAYER,
  );

  assert.deepEqual(balances.get(SEED_MEMBER_IDS.MULTI_OWNER), {
    nickname: "다중 결제 모임 총대",
    paid: 24000,
    owed: 11330,
    balance: 12670,
  });
  assert.deepEqual(balances.get(SEED_MEMBER_IDS.MULTI_GUEST_1), {
    nickname: "다중 결제 참여자 1",
    paid: 30000,
    owed: 19000,
    balance: 11000,
  });
  assert.deepEqual(balances.get(SEED_MEMBER_IDS.MULTI_GUEST_2), {
    nickname: "다중 결제 참여자 2",
    paid: 10000,
    owed: 19330,
    balance: -9330,
  });
  assert.deepEqual(balances.get(SEED_MEMBER_IDS.MULTI_GUEST_3), {
    nickname: "다중 결제 참여자 3",
    paid: 0,
    owed: 14340,
    balance: -14340,
  });
  assert.equal(
    [...balances.values()].reduce(
      (total, memberBalance) => total + memberBalance.balance,
      0,
    ),
    0,
  );
});

test("payments reproduce every item consumer exactly once", async () => {
  const seedDocuments = await buildSeedDocuments("better-auth-owner-id");
  const expectedPaymentKeys = seedDocuments.receipts.flatMap((receipt) =>
    receipt.items.flatMap((item) =>
      item.consumer_member_ids.map((memberId) =>
        JSON.stringify([receipt._id, item._id, memberId]),
      ),
    ),
  );
  const actualPaymentKeys = seedDocuments.payments.map((payment) =>
    JSON.stringify([
      payment.receipt_id,
      payment.expense_item_id,
      payment.payer_member_id,
    ]),
  );

  assert.deepEqual(actualPaymentKeys.sort(), expectedPaymentKeys.sort());
  assert.equal(
    seedDocuments.payments.filter((payment) => payment.status === "paid").length,
    9,
  );
  assert.equal(
    seedDocuments.payments.filter((payment) => payment.status === "unpaid")
      .length,
    15,
  );
});

test("invites use one slot each and guest sessions keep member IDs separate", async () => {
  const seedDocuments = await buildSeedDocuments("better-auth-owner-id");
  const waitingInvites = seedDocuments.invites.filter(
    (invite) => invite.group_id === SEED_GROUP_IDS.TOGETHER_WAITING,
  );
  const claimedInvites = seedDocuments.invites.filter(
    (invite) =>
      invite.group_id === SEED_GROUP_IDS.TOGETHER_ACTIVE_MULTI_PAYER,
  );

  assert.equal(waitingInvites.length, 3);
  assert.equal(waitingInvites.every((invite) => invite.member_id === null), true);
  assert.equal(claimedInvites.length, 3);
  assert.equal(claimedInvites.every((invite) => invite.member_id !== null), true);
  assert.equal(seedDocuments.guestSessions.length, 3);

  for (const guestSession of seedDocuments.guestSessions) {
    assert.notEqual(guestSession._id, guestSession.member_id);
    assert.equal(Object.hasOwn(guestSession, "token"), false);
    assert.match(guestSession.token_hash, /^[0-9a-f]{64}$/);
  }
});

test("seed preview reports every collection without identifiers or token hashes", async () => {
  const seedDocuments = await buildSeedDocuments("better-auth-owner-id");
  const preview = createSeedPreview(seedDocuments);
  const previewText = JSON.stringify(preview);

  assert.equal(preview.writesToDatabase, false);
  assert.deepEqual(preview.collections, {
    expense_group: 4,
    group_member: 13,
    receipts: 6,
    payment: 24,
    invite: 6,
    guest_session: 3,
  });
  assert.deepEqual(
    preview.groups.map((group) => group.joinedMemberCount),
    [1, 4, 4, 4],
  );
  assert.equal(previewText.includes("better-auth-owner-id"), false);
  assert.equal(previewText.includes(SEED_GROUP_IDS.TOGETHER_WAITING), false);
  assert.equal(previewText.includes("token_hash"), false);
});

test("owner user ID is required before seed documents are built", async () => {
  await assert.rejects(() => buildSeedDocuments(""), /ownerUserId/);
  await assert.rejects(() => buildSeedDocuments(null), /ownerUserId/);
});

test("seed validation rejects a broken payment reference before writing", async () => {
  const seedDocuments = await buildSeedDocuments("better-auth-owner-id");
  seedDocuments.payments[0].receipt_id = "00000000-0000-4000-8000-000000000000";

  await assert.rejects(
    () => validateSeedDocuments(seedDocuments),
    /reference its group, receipt, and item/,
  );
});

test("seed validation rejects an extra registered group member", async () => {
  const seedDocuments = await buildSeedDocuments("better-auth-owner-id");
  const guestMember = seedDocuments.groupMembers.find(
    (member) => member._id === SEED_MEMBER_IDS.SOLO_GUEST_1,
  );
  guestMember.member_type = "registered";
  guestMember.user_id = "another-user-id";

  await assert.rejects(
    () => validateSeedDocuments(seedDocuments),
    /exactly one registered owner/,
  );
});

test("seed validation rejects an item consumer outside receipt participants", async () => {
  const seedDocuments = await buildSeedDocuments("better-auth-owner-id");
  const soloReceipt = seedDocuments.receipts.find(
    (receipt) => receipt.group_id === SEED_GROUP_IDS.SOLO_ACTIVE,
  );
  soloReceipt.participant_member_ids = [SEED_MEMBER_IDS.SOLO_OWNER];

  await assert.rejects(
    () => validateSeedDocuments(seedDocuments),
    /receipt participant/,
  );
});

test("seed validation rejects raw invite tokens", async () => {
  const seedDocuments = await buildSeedDocuments("better-auth-owner-id");
  seedDocuments.invites[0].token = "must-not-be-stored";

  await assert.rejects(
    () => validateSeedDocuments(seedDocuments),
    /must not store a raw token/,
  );
});

test("seed writes require an explicit matching database name", () => {
  assert.deepEqual(
    getSeedWriteConfiguration({
      NODE_ENV: "development",
      ALLOW_DATABASE_SEED: "true",
      MONGODB_URI: "mongodb://example.invalid",
      MONGODB_DB: "dutchpay-development",
      SEED_ALLOWED_DATABASE: "dutchpay-development",
      SEED_OWNER_EMAIL: "Owner@Example.com ",
    }),
    {
      uri: "mongodb://example.invalid",
      databaseName: "dutchpay-development",
      ownerEmail: "owner@example.com",
    },
  );
  assert.throws(
    () =>
      getSeedWriteConfiguration({
        ALLOW_DATABASE_SEED: "true",
        MONGODB_URI: "mongodb://example.invalid",
        MONGODB_DB: "unexpected-database",
        SEED_ALLOWED_DATABASE: "dutchpay-development",
        SEED_OWNER_EMAIL: "owner@example.com",
      }),
    /must exactly match/,
  );
  assert.throws(
    () =>
      getSeedWriteConfiguration({
        NODE_ENV: "production",
        ALLOW_DATABASE_SEED: "true",
      }),
    /not allowed/,
  );
});
