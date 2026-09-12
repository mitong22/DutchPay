import { randomInt as secureRandomInt } from "node:crypto";

// Teacher: 이 브랜치의 AGENTS.md는 10원 단위 정산을 요구합니다. 100원을 3명이 나누면 30·30·40원이며, 추가 10원을 낼 사람은 저장할 때 뽑아 기록합니다. 다른 브랜치의 1원 단위 계산을 그대로 가져오면 요구사항이 달라집니다.
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

  // Teacher: 배열의 앞부분과 무작위 위치를 교환해 같은 사람을 두 번 뽑지 않는 로직입니다. AI에게 A·B·C 배열의 교환 과정을 표로 설명하고 구조 분해 대입을 임시 변수로 풀어 달라고 해 보세요. randomInt를 인자로 받으면 테스트에서는 뽑힐 위치를 고정할 수 있습니다.
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

  const recipientCount = getRemainderRecipientCount({
    lineTotal,
    consumerCount: consumerMemberIds.length,
  });
  // 과거 데이터에는 이 필드가 없었다. 남는 몫이 0인 경우에만 빈 배열로
  // 해석할 수 있으며, 남는 몫이 있다면 담당자를 추측하지 않고 오류로 막는다.
  const normalizedRemainderRecipientMemberIds =
    remainderRecipientMemberIds === undefined && recipientCount === 0
      ? []
      : remainderRecipientMemberIds;

  if (!Array.isArray(normalizedRemainderRecipientMemberIds)) {
    throw new TypeError("remainderRecipientMemberIds must be an array.");
  }

  if (
    normalizedRemainderRecipientMemberIds.some(
      (memberId) => typeof memberId !== "string" || memberId.length === 0,
    )
  ) {
    throw new TypeError(
      "remainderRecipientMemberIds must contain non-empty string IDs.",
    );
  }

  if (
    new Set(normalizedRemainderRecipientMemberIds).size !==
    normalizedRemainderRecipientMemberIds.length
  ) {
    throw new Error(
      "remainderRecipientMemberIds must not contain duplicate member IDs.",
    );
  }

  if (normalizedRemainderRecipientMemberIds.length !== recipientCount) {
    throw new Error(
      "remainderRecipientMemberIds must contain exactly the required number of members.",
    );
  }

  const consumerMemberIdSet = new Set(consumerMemberIds);

  for (const memberId of normalizedRemainderRecipientMemberIds) {
    if (!consumerMemberIdSet.has(memberId)) {
      throw new Error(
        "Every remainder recipient must be an item consumer.",
      );
    }
  }

  const remainderRecipientIdSet = new Set(
    normalizedRemainderRecipientMemberIds,
  );
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
