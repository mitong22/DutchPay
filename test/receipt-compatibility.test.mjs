import assert from "node:assert/strict";
import test from "node:test";

import { normalizeReceiptForRead } from "../lib/receipt-compatibility.mjs";

test("a legacy receipt derives participants from its item consumers", () => {
  const normalizedReceipt = normalizeReceiptForRead({
    _id: "legacy-receipt",
    items: [
      { consumer_member_ids: ["member-a", "member-b"] },
      { consumer_member_ids: ["member-b", "member-c"] },
    ],
  });

  assert.deepEqual(normalizedReceipt.participant_member_ids, [
    "member-a",
    "member-b",
    "member-c",
  ]);
});

test("a current receipt keeps its explicitly stored participant order", () => {
  const receipt = {
    _id: "current-receipt",
    participant_member_ids: ["member-c", "member-a"],
    items: [{ consumer_member_ids: ["member-a"] }],
  };

  assert.equal(normalizeReceiptForRead(receipt), receipt);
});
