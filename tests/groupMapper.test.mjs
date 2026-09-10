import assert from "node:assert/strict";
import test from "node:test";

import { mapGroup } from "../lib/groupMapper.mjs";

test("DB 모임과 영수증을 화면에서 사용하는 구조로 변환한다", () => {
  const group = mapGroup(
    {
      _id: "group-1",
      name: "저녁 모임",
      created_by: "user-1",
      mode: "SOLO",
      status: "ACTIVE",
      expected_member_count: 1,
      member_ids: ["member-1"],
      settlement_completed_at: new Date("2026-09-10T12:00:00.000Z"),
    },
    [
      {
        _id: "member-1",
        user_id: "user-1",
        nickname: "미연",
        member_type: "registered",
      },
    ],
    [
      {
        _id: "receipt-1",
        group_id: "group-1",
        store_name: "식당",
        total_amount: 12000,
        paid_by_member_id: "member-1",
        uploaded_by_member_id: "member-1",
        items: [
          {
            _id: "item-1",
            menu_name: "파스타",
            quantity: 1,
            unit_price: 12000,
            line_total: 12000,
            consumer_member_ids: ["member-1"],
          },
        ],
      },
    ],
  );

  assert.equal(group.status, "COMPLETED");
  assert.equal(group.members[0].id, "member-1");
  assert.deepEqual(group.receipts[0].participant_member_ids, ["member-1"]);
  assert.equal(group.receipts[0].items[0].name, "파스타");
});
