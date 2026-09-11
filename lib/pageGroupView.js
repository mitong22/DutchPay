import "server-only";

import { cookies } from "next/headers";

import { getCurrentUser } from "./auth.js";
import { getGroupView } from "./groups.js";
import { guestCookieName } from "./inviteTokens.mjs";

export async function getPageGroupView(groupId) {
  const user = await getCurrentUser();
  const cookieStore = await cookies();
  const credentials = user
    ? { userId: user.user_id, guestToken: null }
    : {
        userId: null,
        guestToken: cookieStore.get(guestCookieName(groupId))?.value ?? null,
      };

  try {
    const view = await getGroupView(groupId, credentials);
    const captainMember = view.group.members.find(
      (member) => member.user_id === view.group.created_by,
    );

    return {
      ...view,
      captain: user ?? {
        id: captainMember?.id ?? view.group.created_by,
        user_id: view.group.created_by,
        nickname: captainMember?.nickname ?? "총대",
        member_type: "registered",
      },
    };
  } catch (error) {
    if ([401, 403, 404].includes(Number(error?.status))) return null;

    throw error;
  }
}
