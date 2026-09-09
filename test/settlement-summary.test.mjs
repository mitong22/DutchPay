import assert from "node:assert/strict";
import test from "node:test";

import { calculateGroupSettlement } from "../lib/settlement-summary.mjs";

const MEMBERS = [
  { _id: "member-a" },
  { _id: "member-b" },
  { _id: "member-c" },
];

test("group settlement nets multiple receipts into deterministic transfers", () => {
  const result = calculateGroupSettlement({
    members: MEMBERS,
    receipts: [
      {
        paid_by_member_id: "member-c",
        total_amount: 10000,
        items: [
          {
            _id: "item-a",
            line_total: 10000,
            consumer_member_ids: ["member-a", "member-b", "member-c"],
            remainder_recipient_member_ids: ["member-c"],
          },
        ],
      },
      {
        paid_by_member_id: "member-b",
        total_amount: 6000,
        items: [
          {
            _id: "item-b",
            line_total: 6000,
            consumer_member_ids: ["member-a", "member-b"],
            remainder_recipient_member_ids: [],
          },
        ],
      },
    ],
  });

  assert.deepEqual(result.memberTotals, [
    {
      memberId: "member-a",
      paidAmount: 0,
      owedAmount: 6330,
      balance: -6330,
    },
    {
      memberId: "member-b",
      paidAmount: 6000,
      owedAmount: 6330,
      balance: -330,
    },
    {
      memberId: "member-c",
      paidAmount: 10000,
      owedAmount: 3340,
      balance: 6660,
    },
  ]);
  assert.deepEqual(result.transfers, [
    {
      fromMemberId: "member-a",
      toMemberId: "member-c",
      amount: 6330,
    },
    {
      fromMemberId: "member-b",
      toMemberId: "member-c",
      amount: 330,
    },
  ]);
});

test("a settled group has no self-transfer", () => {
  const result = calculateGroupSettlement({
    members: MEMBERS,
    receipts: [],
  });

  assert.deepEqual(result.transfers, []);
  assert.ok(result.memberTotals.every((memberTotal) => memberTotal.balance === 0));
});
