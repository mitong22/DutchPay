"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  ApplicationError,
  getApplicationErrorMessage,
} from "@/lib/application-error";
import { requireGroupContext } from "@/lib/auth-context";
import { regenerateUnusedInvite } from "@/lib/group-service";
import {
  deleteReceipt,
  updatePaymentStatus,
} from "@/lib/receipt-service";

export async function regenerateInviteAction(
  groupId,
  inviteId,
  previousState,
) {
  try {
    const context = await requireGroupContext(groupId);

    if (!context.isOwner) {
      throw new ApplicationError("모임장만 초대 링크를 재발급할 수 있습니다.");
    }

    const invitePath = await regenerateUnusedInvite({ groupId, inviteId });
    revalidatePath(`/groups/${groupId}`);

    return {
      status: "success",
      invitePath,
    };
  } catch (error) {
    return {
      status: "error",
      message: getApplicationErrorMessage(error),
    };
  }
}

export async function deleteReceiptAction(groupId, receiptId) {
  await deleteReceipt({ groupId, receiptId });
  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}`);
}

export async function updatePaymentStatusAction(groupId, formData) {
  await updatePaymentStatus({
    groupId,
    paymentId: String(formData.get("payment_id") || ""),
    status: String(formData.get("status") || ""),
  });
  revalidatePath(`/groups/${groupId}`);
}
