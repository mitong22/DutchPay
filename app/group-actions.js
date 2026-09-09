"use server";

import { revalidatePath } from "next/cache";

import { getApplicationErrorMessage } from "@/lib/application-error";
import { requireRegisteredSession } from "@/lib/auth-context";
import { createExpenseGroup } from "@/lib/group-service";

export async function createGroupAction(previousState, formData) {
  try {
    const session = await requireRegisteredSession();
    const result = await createExpenseGroup({
      userId: session.user.id,
      userName: session.user.name || session.user.email,
      groupName: String(formData.get("groupName") || ""),
      ownerNickname: String(formData.get("ownerNickname") || ""),
      mode: String(formData.get("mode") || ""),
      soloMemberNicknames: formData
        .getAll("soloMemberNickname")
        .map(String),
      togetherMemberCount: Number(formData.get("togetherMemberCount")),
    });

    revalidatePath("/");

    return {
      status: "success",
      groupId: result.groupId,
      mode: result.mode,
      invitePaths: result.invitePaths,
    };
  } catch (error) {
    return {
      status: "error",
      message: getApplicationErrorMessage(error),
    };
  }
}
