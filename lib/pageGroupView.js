import "server-only";

import { cookies } from "next/headers";

import { getGroupView } from "./groups.js";
import { guestCookieName } from "./inviteTokens.mjs";
import { MOCK_CAPTAIN } from "./mockCaptain.js";
import { MOCK_ACCOUNT_COOKIE } from "./mockSession.mjs";

export async function getPageGroupView(groupId) {
  const cookieStore = await cookies();
  const hasCaptainSession =
    cookieStore.get(MOCK_ACCOUNT_COOKIE)?.value === MOCK_CAPTAIN.user_id;
  const credentials = hasCaptainSession
    ? { userId: MOCK_CAPTAIN.user_id, guestToken: null }
    : {
        userId: null,
        guestToken: cookieStore.get(guestCookieName(groupId))?.value ?? null,
      };

  try {
    return await getGroupView(groupId, credentials);
  } catch (error) {
    if ([401, 403, 404].includes(Number(error?.status))) return null;

    throw error;
  }
}
