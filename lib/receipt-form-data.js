import { ApplicationError } from "@/lib/application-error";
import { MAX_RECEIPT_ITEM_COUNT } from "@/lib/receipt-rules.mjs";

export function readReceiptFormData(formData) {
  const menuCount = Number(formData.get("menu_count"));

  if (
    !Number.isSafeInteger(menuCount) ||
    menuCount < 1 ||
    menuCount > MAX_RECEIPT_ITEM_COUNT
  ) {
    throw new ApplicationError(
      `메뉴는 1개 이상 ${MAX_RECEIPT_ITEM_COUNT}개 이하로 입력해 주세요.`,
    );
  }

  const menuInputs = [];

  // Teacher: 화면의 menu_name_0, line_total_0, consumer_member_ids_0가 첫 메뉴로 묶입니다. 같은 name의 체크박스 여러 개는 getAll로 받습니다. 메뉴 2개를 입력한 FormData 예시를 AI에게 펼쳐 달라고 한 뒤, 문자열 금액이 receipt-rules.mjs에서 숫자로 변환·검증되는 순서를 따라가 보세요.
  for (let menuIndex = 0; menuIndex < menuCount; menuIndex += 1) {
    menuInputs.push({
      itemId: String(formData.get(`item_id_${menuIndex}`) ?? ""),
      menuName: String(formData.get(`menu_name_${menuIndex}`) ?? ""),
      lineTotal: String(formData.get(`line_total_${menuIndex}`) ?? ""),
      consumerMemberIds: formData
        .getAll(`consumer_member_ids_${menuIndex}`)
        .map(String),
    });
  }

  return {
    storeName: String(formData.get("store_name") ?? ""),
    paidByMemberId: String(formData.get("paid_by_member_id") ?? ""),
    participantMemberIds: formData
      .getAll("participant_member_ids")
      .map(String),
    menuInputs,
  };
}
