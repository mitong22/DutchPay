import "server-only";

import { guestCookieName } from "./inviteTokens.mjs";
import { MOCK_CAPTAIN } from "./mockCaptain.js";
import { MOCK_ACCOUNT_COOKIE } from "./mockSession.mjs";

export function getMockCaptain(request) {
  return request.cookies.get(MOCK_ACCOUNT_COOKIE)?.value ===
    MOCK_CAPTAIN.user_id
    ? MOCK_CAPTAIN
    : null;
}

export function getGroupCredentials(request, groupId) {
  const captain = getMockCaptain(request);

  if (captain) {
    return { userId: captain.user_id, guestToken: null };
  }

  return {
    userId: null,
    guestToken: request.cookies.get(guestCookieName(groupId))?.value ?? null,
  };
}
