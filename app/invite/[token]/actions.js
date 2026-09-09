"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getApplicationErrorMessage } from "@/lib/application-error";
import { setGuestSessionCookie } from "@/lib/auth-context";
import { claimInvite } from "@/lib/invite-service";

export async function claimInviteAction(rawToken, previousState, formData) {
  let result;

  try {
    result = await claimInvite({
      rawToken,
      nickname: String(formData.get("nickname") || ""),
    });
    await setGuestSessionCookie(
      result.rawGuestSessionToken,
      result.expiresAt,
    );
  } catch (error) {
    return {
      status: "error",
      message: getApplicationErrorMessage(error),
    };
  }

  revalidatePath(`/groups/${result.groupId}`);
  redirect(`/groups/${result.groupId}`);
}
