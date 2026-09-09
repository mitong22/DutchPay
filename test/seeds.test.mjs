import assert from "node:assert/strict";
import test from "node:test";

import { validatePersistedGroupState } from "../lib/group-rules.mjs";
import validationModule from "../scripts/seed-data-validation.js";
import seedModule from "../scripts/seeds.js";

const {
  SEED_GROUP_IDS,
  buildSeedDocuments,
  createSeedPreview,
  parseSeedCommand,
} = seedModule;
const { validateSeedDocuments } = validationModule;

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

test("seed data is an Atlas-based WAITING group and migrated ACTIVE group", async () => {
  const seedDocuments = await buildSeedDocuments("better-auth-owner-id");
  const modes = seedDocuments.expenseGroups.map((group) => group.mode);
  const statuses = seedDocuments.expenseGroups.map((group) => group.status);

  assert.deepEqual(modes, ["TOGETHER", "TOGETHER"]);
  assert.deepEqual(statuses, ["WAITING", "ACTIVE"]);
  assert.equal(
    seedDocuments.expenseGroups.some((group) => group.mode === "shared"),
    false,
  );
  assert.equal(seedDocuments.groupMembers.length, 5);
  assert.equal(seedDocuments.receipts.length, 1);
  assert.equal(seedDocuments.receipts[0].items.length, 2);
  assert.equal(seedDocuments.payments.length, 5);
});

test("every seed group has one registered owner and no member_ids array", async () => {
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
  const [receipt] = seedDocuments.receipts;

  assert.equal(
    receipt.group_id,
    SEED_GROUP_IDS.TOGETHER_ACTIVE_FROM_SHARED,
  );
  assert.equal(receipt.total_amount, 36000);
  assert.deepEqual(
    receipt.items.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unit_price,
      lineTotal: item.line_total,
      consumerCount: item.consumer_member_ids.length,
    })),
    [
      { quantity: 2, unitPrice: 15000, lineTotal: 30000, consumerCount: 3 },
      { quantity: 2, unitPrice: 3000, lineTotal: 6000, consumerCount: 2 },
    ],
  );
  assert.equal(
    receipt.items.reduce((total, item) => total + item.line_total, 0),
    receipt.total_amount,
  );
});

test("payments reproduce every Atlas item consumer exactly once", async () => {
  const seedDocuments = await buildSeedDocuments("better-auth-owner-id");
  const [receipt] = seedDocuments.receipts;
  const expectedPaymentKeys = receipt.items.flatMap((item) =>
    item.consumer_member_ids.map((memberId) =>
      JSON.stringify([receipt._id, item._id, memberId]),
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
    2,
  );
  assert.equal(
    seedDocuments.payments.filter((payment) => payment.status === "unpaid")
      .length,
    3,
  );
});

test("seed preview reports all collections without identifiers", async () => {
  const seedDocuments = await buildSeedDocuments("better-auth-owner-id");
  const preview = createSeedPreview(seedDocuments);
  const previewText = JSON.stringify(preview);

  assert.equal(preview.writesToDatabase, false);
  assert.deepEqual(preview.collections, {
    expense_group: 2,
    group_member: 5,
    receipts: 1,
    payment: 5,
  });
  assert.deepEqual(
    preview.groups.map((group) => group.joinedMemberCount),
    [1, 4],
  );
  assert.deepEqual(
    preview.groups.map((group) => group.paymentCount),
    [0, 5],
  );
  assert.equal(previewText.includes("better-auth-owner-id"), false);
  assert.equal(previewText.includes(SEED_GROUP_IDS.TOGETHER_WAITING), false);
});

test("owner user ID is required before seed documents are built", async () => {
  await assert.rejects(() => buildSeedDocuments(""), /ownerUserId/);
  await assert.rejects(() => buildSeedDocuments(null), /ownerUserId/);
});

test("seed validation rejects a broken payment reference before writing", async () => {
  const seedDocuments = await buildSeedDocuments("better-auth-owner-id");
  seedDocuments.payments[0].receipt_id = "missing-receipt-id";

  assert.throws(
    () =>
      validateSeedDocuments(seedDocuments, validatePersistedGroupState),
    /reference its group, receipt, and item/,
  );
});
