import { randomInt as secureRandomInt } from "node:crypto";

export const SETTLEMENT_MONEY_UNIT = 10;

function assertMemberIds(memberIds, fieldName) {
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty array.`);
  }

  if (
    memberIds.some(
      (memberId) => typeof memberId !== "string" || memberId.length === 0,
    )
  ) {
    throw new TypeError(`${fieldName} must contain non-empty string IDs.`);
  }

  if (new Set(memberIds).size !== memberIds.length) {
    throw new Error(`${fieldName} must not contain duplicate member IDs.`);
  }

  return memberIds;
}

export function assertSettlementAmount(amount, fieldName = "amount") {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new TypeError(`${fieldName} must be a non-negative safe integer.`);
  }

  if (amount % SETTLEMENT_MONEY_UNIT !== 0) {
    throw new RangeError(
      `${fieldName} must be divisible by ${SETTLEMENT_MONEY_UNIT} won.`,
    );
  }

  return amount;
}

export function getRemainderRecipientCount({ lineTotal, consumerCount }) {
  assertSettlementAmount(lineTotal, "lineTotal");

  if (!Number.isSafeInteger(consumerCount) || consumerCount < 1) {
    throw new TypeError("consumerCount must be a positive safe integer.");
  }

  const totalUnitCount = lineTotal / SETTLEMENT_MONEY_UNIT;
  return totalUnitCount % consumerCount;
}

export function chooseRandomRemainderRecipientIds({
  lineTotal,
  consumerMemberIds,
  randomInt = secureRandomInt,
}) {
  assertMemberIds(consumerMemberIds, "consumerMemberIds");

  if (typeof randomInt !== "function") {
    throw new TypeError("randomInt must be a function.");
  }

  const recipientCount = getRemainderRecipientCount({
    lineTotal,
    consumerCount: consumerMemberIds.length,
  });
  const candidates = [...consumerMemberIds];

  for (let index = 0; index < recipientCount; index += 1) {
    const selectedIndex = randomInt(index, candidates.length);

    if (
      !Number.isSafeInteger(selectedIndex) ||
      selectedIndex < index ||
      selectedIndex >= candidates.length
    ) {
      throw new RangeError(
        "randomInt must return an integer inside the requested range.",
      );
    }

    [candidates[index], candidates[selectedIndex]] = [
      candidates[selectedIndex],
      candidates[index],
    ];
  }

  return candidates.slice(0, recipientCount);
}

export function calculateItemShares({
  lineTotal,
  consumerMemberIds,
  remainderRecipientMemberIds,
}) {
  assertMemberIds(consumerMemberIds, "consumerMemberIds");

  if (!Array.isArray(remainderRecipientMemberIds)) {
    throw new TypeError("remainderRecipientMemberIds must be an array.");
  }

  if (
    remainderRecipientMemberIds.some(
      (memberId) => typeof memberId !== "string" || memberId.length === 0,
    )
  ) {
    throw new TypeError(
      "remainderRecipientMemberIds must contain non-empty string IDs.",
    );
  }

  if (
    new Set(remainderRecipientMemberIds).size !==
    remainderRecipientMemberIds.length
  ) {
    throw new Error(
      "remainderRecipientMemberIds must not contain duplicate member IDs.",
    );
  }

  const recipientCount = getRemainderRecipientCount({
    lineTotal,
    consumerCount: consumerMemberIds.length,
  });

  if (remainderRecipientMemberIds.length !== recipientCount) {
    throw new Error(
      "remainderRecipientMemberIds must contain exactly the required number of members.",
    );
  }

  const consumerMemberIdSet = new Set(consumerMemberIds);

  for (const memberId of remainderRecipientMemberIds) {
    if (!consumerMemberIdSet.has(memberId)) {
      throw new Error(
        "Every remainder recipient must be an item consumer.",
      );
    }
  }

  const remainderRecipientIdSet = new Set(remainderRecipientMemberIds);
  const baseShare =
    Math.floor(
      lineTotal /
        SETTLEMENT_MONEY_UNIT /
        consumerMemberIds.length,
    ) * SETTLEMENT_MONEY_UNIT;

  return consumerMemberIds.map((memberId) => ({
    memberId,
    amount:
      baseShare +
      (remainderRecipientIdSet.has(memberId)
        ? SETTLEMENT_MONEY_UNIT
        : 0),
  }));
}
