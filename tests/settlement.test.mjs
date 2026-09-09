import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateSettlement,
  receiptsForMember,
  splitAmount,
} from "../lib/settlement.mjs";

test("선택한 사람이 결제한 영수증만 보여준다", () => {
  const receipts = [
    { _id: "a-receipt", paid_by_member_id: "a", items: [] },
    {
      _id: "b-receipt",
      paid_by_member_id: "b",
      items: [{ consumer_member_ids: ["a"] }],
    },
  ];

  assert.deepEqual(
    receiptsForMember(receipts, "a").map((receipt) => receipt._id),
    ["a-receipt"],
  );
});

test("메뉴 금액과 최종 정산액이 보존된다", () => {
  assert.deepEqual(splitAmount(10, ["a", "b", "c"]), [
    { memberId: "a", amount: 4 },
    { memberId: "b", amount: 3 },
    { memberId: "c", amount: 3 },
  ]);

  const result = calculateSettlement(
    [
      {
        paid_by_member_id: "a",
        total_amount: 10,
        items: [
          {
            line_total: 10,
            consumer_member_ids: ["a", "b", "c"],
          },
        ],
      },
    ],
    ["a", "b", "c"].map((_id) => ({ _id })),
  );

  assert.equal(result.rows.reduce((sum, row) => sum + row.balance, 0), 0);
  assert.equal(result.transfers.reduce((sum, row) => sum + row.amount, 0), 6);
});
