import assert from "node:assert/strict";
import test from "node:test";

import {
  SETTLEMENT_MONEY_UNIT,
  assertSettlementAmount,
  calculateItemShares,
  chooseRandomRemainderRecipientIds,
  getRemainderRecipientCount,
} from "../lib/settlement-rules.mjs";

const CONSUMER_IDS = ["member-a", "member-b", "member-c"];

test("settlement amounts use 10-won units", () => {
  assert.equal(SETTLEMENT_MONEY_UNIT, 10);
  assert.equal(assertSettlementAmount(10000), 10000);
  assert.throws(() => assertSettlementAmount(10005), /divisible by 10 won/);
  assert.throws(() => assertSettlementAmount(-10), /non-negative/);
});

test("10,000 won split three ways needs one random 10-won recipient", () => {
  assert.equal(
    getRemainderRecipientCount({
      lineTotal: 10000,
      consumerCount: 3,
    }),
    1,
  );

  const selectedMemberIds = chooseRandomRemainderRecipientIds({
    lineTotal: 10000,
    consumerMemberIds: CONSUMER_IDS,
    randomInt(minimum, maximum) {
      assert.equal(minimum, 0);
      assert.equal(maximum, 3);
      return 2;
    },
  });

  assert.deepEqual(selectedMemberIds, ["member-c"]);
});

test("stored random recipients make 10-won shares stable and conserve the total", () => {
  const shares = calculateItemShares({
    lineTotal: 10000,
    consumerMemberIds: CONSUMER_IDS,
    remainderRecipientMemberIds: ["member-c"],
  });

  assert.deepEqual(shares, [
    { memberId: "member-a", amount: 3330 },
    { memberId: "member-b", amount: 3330 },
    { memberId: "member-c", amount: 3340 },
  ]);
  assert.equal(
    shares.reduce((total, share) => total + share.amount, 0),
    10000,
  );
});

test("an exactly divisible menu stores no remainder recipients", () => {
  assert.deepEqual(
    calculateItemShares({
      lineTotal: 6000,
      consumerMemberIds: ["member-a", "member-b"],
      remainderRecipientMemberIds: [],
    }),
    [
      { memberId: "member-a", amount: 3000 },
      { memberId: "member-b", amount: 3000 },
    ],
  );
});

test("remainder recipients must match the required count and consumers", () => {
  assert.throws(
    () =>
      calculateItemShares({
        lineTotal: 10000,
        consumerMemberIds: CONSUMER_IDS,
        remainderRecipientMemberIds: [],
      }),
    /exactly the required number/,
  );
  assert.throws(
    () =>
      calculateItemShares({
        lineTotal: 10000,
        consumerMemberIds: CONSUMER_IDS,
        remainderRecipientMemberIds: ["member-outside"],
      }),
    /must be an item consumer/,
  );
});
