import { assertSettlementAmount } from "./settlement-rules.mjs";

export const MAX_RECEIPT_ITEM_COUNT = 50;

function normalizeRequiredText(value, fieldName, maximumLength) {
  if (typeof value !== "string") {
    throw new TypeError(`${fieldName} must be a string.`);
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length === 0 || normalizedValue.length > maximumLength) {
    throw new RangeError(
      `${fieldName} must be between 1 and ${maximumLength} characters.`,
    );
  }

  return normalizedValue;
}

function normalizeUniqueMemberIds(memberIds, fieldName) {
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    throw new RangeError(`${fieldName} must contain at least one member.`);
  }

  if (
    memberIds.some(
      (memberId) => typeof memberId !== "string" || memberId.trim() === "",
    )
  ) {
    throw new TypeError(`${fieldName} must contain string member IDs.`);
  }

  const normalizedMemberIds = memberIds.map((memberId) => memberId.trim());

  if (new Set(normalizedMemberIds).size !== normalizedMemberIds.length) {
    throw new Error(`${fieldName} must not contain duplicate member IDs.`);
  }

  return normalizedMemberIds;
}

export function validateReceiptDraft({
  storeName,
  paidByMemberId,
  uploadedByMemberId,
  participantMemberIds,
  menuInputs,
  allowedMemberIds,
  mode,
  ownerMemberId,
}) {
  const normalizedStoreName = normalizeRequiredText(storeName, "storeName", 80);
  const normalizedAllowedMemberIds = new Set(allowedMemberIds);
  const normalizedParticipantMemberIds = normalizeUniqueMemberIds(
    participantMemberIds,
    "participantMemberIds",
  );

  if (!normalizedAllowedMemberIds.has(uploadedByMemberId)) {
    throw new Error("uploadedByMemberId must belong to the group.");
  }

  const effectivePaidByMemberId = mode === "SOLO" ? ownerMemberId : paidByMemberId;

  if (!normalizedAllowedMemberIds.has(effectivePaidByMemberId)) {
    throw new Error("paidByMemberId must belong to the group.");
  }

  for (const memberId of normalizedParticipantMemberIds) {
    if (!normalizedAllowedMemberIds.has(memberId)) {
      throw new Error("Every receipt participant must belong to the group.");
    }
  }

  if (!Array.isArray(menuInputs) || menuInputs.length === 0) {
    throw new RangeError("menuInputs must contain at least one item.");
  }

  if (menuInputs.length > MAX_RECEIPT_ITEM_COUNT) {
    throw new RangeError(
      `menuInputs cannot contain more than ${MAX_RECEIPT_ITEM_COUNT} items.`,
    );
  }

  // Teacher: 모임 회원 ⊇ 영수증 참여자 ⊇ 메뉴를 먹은 사람이라는 세 단계 관계를 검증합니다. Set.has는 중복 없는 ID 목록에서 포함 여부를 찾는 표현입니다. 화면의 체크박스 제한을 우회한 값도 서버로 보낼 수 있으므로, A·B만 참석한 영수증에 C를 메뉴 참여자로 넣었을 때 막히는 위치를 찾아보세요.
  const participantIdSet = new Set(normalizedParticipantMemberIds);
  const normalizedMenuInputs = menuInputs.map((menuInput, menuIndex) => {
    const menuName = normalizeRequiredText(
      menuInput.menuName,
      `menuInputs[${menuIndex}].menuName`,
      80,
    );
    const lineTotal = Number(menuInput.lineTotal);
    assertSettlementAmount(lineTotal, `menuInputs[${menuIndex}].lineTotal`);

    if (lineTotal === 0) {
      throw new RangeError(
        `menuInputs[${menuIndex}].lineTotal must be greater than zero.`,
      );
    }

    const consumerMemberIds = normalizeUniqueMemberIds(
      menuInput.consumerMemberIds,
      `menuInputs[${menuIndex}].consumerMemberIds`,
    );

    for (const memberId of consumerMemberIds) {
      if (!participantIdSet.has(memberId)) {
        throw new Error("Every item consumer must be a receipt participant.");
      }
    }

    return {
      itemId:
        typeof menuInput.itemId === "string" ? menuInput.itemId.trim() : "",
      menuName,
      lineTotal,
      consumerMemberIds,
    };
  });

  const totalAmount = normalizedMenuInputs.reduce(
    (total, menuInput) => total + menuInput.lineTotal,
    0,
  );
  assertSettlementAmount(totalAmount, "totalAmount");

  return {
    storeName: normalizedStoreName,
    totalAmount,
    paidByMemberId: effectivePaidByMemberId,
    uploadedByMemberId,
    participantMemberIds: normalizedParticipantMemberIds,
    menuInputs: normalizedMenuInputs,
  };
}
