import assert from "node:assert/strict";
import test from "node:test";

import { buildSeedDocuments } from "../scripts/seed-data.mjs";

function assertValidDataset(seed) {
  const groupIds = new Set(seed.groups.map((group) => group._id));
  const memberIds = new Set(seed.members.map((member) => member._id));
  const receiptIds = new Set(seed.receipts.map((receipt) => receipt._id));
  const itemIds = new Set(
    seed.receipts.flatMap((receipt) => receipt.items.map((item) => item._id)),
  );

  for (const group of seed.groups) {
    assert(group.member_ids.every((memberId) => memberIds.has(memberId)));
    assert(
      seed.members.some(
        (member) =>
          member.group_id === group._id && member.user_id === "mock-user-001",
      ),
    );
  }

  for (const receipt of seed.receipts) {
    assert(groupIds.has(receipt.group_id));
    assert(memberIds.has(receipt.paid_by_member_id));
    assert.equal(
      receipt.total_amount,
      receipt.items.reduce((total, item) => total + item.line_total, 0),
    );

    for (const item of receipt.items) {
      assert.equal(item.line_total, item.quantity * item.unit_price);
      assert(item.consumer_member_ids.every((memberId) => memberIds.has(memberId)));
    }
  }

  for (const payment of seed.payments) {
    assert(groupIds.has(payment.group_id));
    assert(receiptIds.has(payment.receipt_id));
    assert(itemIds.has(payment.expense_item_id));
    assert(memberIds.has(payment.payer_member_id));
    assert(memberIds.has(payment.payee_member_id));
  }
}

test("demo와 test seed가 참조·금액 정합성을 유지한다", () => {
  const demo = buildSeedDocuments("demo", "hashed-password");
  const verification = buildSeedDocuments("test", "hashed-password");

  assert.equal(demo.groups.length, 4);
  assert.equal(verification.groups.length, 10);
  assert(demo.groups.every((group) => !group.name.startsWith("[검증]")));
  assert(verification.groups.every((group) => group.name.startsWith("[검증]")));
  assert(
    demo.groups.every((group) =>
      group._id.startsWith("seed-demo-group-"),
    ),
  );
  assert(
    verification.groups.every((group) =>
      group._id.startsWith("seed-test-group-"),
    ),
  );

  assertValidDataset(demo);
  assertValidDataset(verification);

  const completedGroup = verification.groups.find((group) =>
    group.name.includes("전체 정산 완료"),
  );
  const completedPayments = verification.payments.filter(
    (payment) => payment.group_id === completedGroup._id,
  );
  assert(completedPayments.every((payment) => payment.status === "paid"));

  const partialGroup = verification.groups.find((group) =>
    group.name.includes("일부 송금 완료"),
  );
  const partialStatuses = new Set(
    verification.payments
      .filter((payment) => payment.group_id === partialGroup._id)
      .map((payment) => payment.status),
  );
  assert.deepEqual(partialStatuses, new Set(["paid", "unpaid"]));
  assert.throws(() => buildSeedDocuments("unknown", "hashed-password"));
});
