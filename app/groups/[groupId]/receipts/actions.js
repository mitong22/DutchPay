"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  ApplicationError,
  getApplicationErrorMessage,
} from "@/lib/application-error";
import { requireGroupContext } from "@/lib/auth-context";
import { GROUP_STATUS } from "@/lib/group-rules.mjs";
import { readReceiptFormData } from "@/lib/receipt-form-data";
import { createReceipt, updateReceipt } from "@/lib/receipt-service";
import { isTemporaryReceiptDataEnabled } from "@/lib/temporary-receipt-config";
import { loadRandomTemporaryReceiptDraft } from "@/lib/temporary-receipt-data";

export async function loadTemporaryReceiptAction(
  groupId,
  previousState,
  formData,
) {
  try {
    if (!isTemporaryReceiptDataEnabled()) {
      throw new ApplicationError(
        "임시 영수증 데이터 기능이 비활성화되어 있습니다.",
        "TEMPORARY_RECEIPT_DATA_DISABLED",
      );
    }

    const context = await requireGroupContext(groupId);

    if (context.group.status !== GROUP_STATUS.ACTIVE) {
      throw new ApplicationError(
        "활성화된 모임에서만 영수증을 추가할 수 있습니다.",
        "GROUP_NOT_ACTIVE",
      );
    }

    const draft = await loadRandomTemporaryReceiptDraft();

    return {
      status: "success",
      message: "",
      loadId: randomUUID(),
      draft,
    };
  } catch (error) {
    return {
      status: "error",
      message: getApplicationErrorMessage(error),
      loadId: "",
      draft: null,
    };
  }
}

export async function saveReceiptAction(
  groupId,
  receiptId,
  previousState,
  formData,
) {
  let savedReceiptId;

  try {
    const rawDraft = readReceiptFormData(formData);

    if (receiptId) {
      await updateReceipt({ groupId, receiptId, rawDraft });
      savedReceiptId = receiptId;
    } else {
      savedReceiptId = await createReceipt({ groupId, rawDraft });
    }
  } catch (error) {
    return {
      status: "error",
      message: getApplicationErrorMessage(error),
    };
  }

  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}?receipt=${savedReceiptId}`);
}
