"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getApplicationErrorMessage } from "@/lib/application-error";
import { readReceiptFormData } from "@/lib/receipt-form-data";
import { createReceipt, updateReceipt } from "@/lib/receipt-service";

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
