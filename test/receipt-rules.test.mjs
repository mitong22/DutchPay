import assert from "node:assert/strict";
import test from "node:test";

import { validateReceiptDraft } from "../lib/receipt-rules.mjs";

const MEMBER_IDS = ["owner", "guest-a", "guest-b"];

function createValidDraft(overrides = {}) {
  return {
    storeName: "저녁 식사",
    paidByMemberId: "guest-a",
    uploadedByMemberId: "owner",
    participantMemberIds: MEMBER_IDS,
    menuInputs: [
      {
        menuName: "파스타",
        lineTotal: "10000",
        consumerMemberIds: MEMBER_IDS,
      },
    ],
    allowedMemberIds: MEMBER_IDS,
    mode: "TOGETHER",
    ownerMemberId: "owner",
    ...overrides,
  };
}

test("receipt input is normalized and totaled on the server", () => {
  const receipt = validateReceiptDraft(createValidDraft());

  assert.equal(receipt.storeName, "저녁 식사");
  assert.equal(receipt.totalAmount, 10000);
  assert.equal(receipt.paidByMemberId, "guest-a");
  assert.deepEqual(receipt.menuInputs[0].consumerMemberIds, MEMBER_IDS);
});

test("SOLO always forces the registered owner as payer", () => {
  const receipt = validateReceiptDraft(
    createValidDraft({ mode: "SOLO", paidByMemberId: "guest-a" }),
  );

  assert.equal(receipt.paidByMemberId, "owner");
});

test("receipt amounts must use positive 10-won units", () => {
  assert.throws(
    () =>
      validateReceiptDraft(
        createValidDraft({
          menuInputs: [
            {
              menuName: "파스타",
              lineTotal: "10005",
              consumerMemberIds: MEMBER_IDS,
            },
          ],
        }),
      ),
    /divisible by 10 won/,
  );
});

test("menu consumers must be receipt participants", () => {
  assert.throws(
    () =>
      validateReceiptDraft(
        createValidDraft({
          participantMemberIds: ["owner", "guest-a"],
          menuInputs: [
            {
              menuName: "파스타",
              lineTotal: "10000",
              consumerMemberIds: ["owner", "guest-b"],
            },
          ],
        }),
      ),
    /must be a receipt participant/,
  );
});
