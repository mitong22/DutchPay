import "server-only";

import { getRequestUser } from "./auth.js";
import { guestCookieName } from "./inviteTokens.mjs";

export { getRequestUser };

export async function getGroupCredentials(request, groupId) {
  const user = await getRequestUser(request);

  return user
    ? { userId: user.user_id, guestToken: null }
    : {
        userId: null,
        guestToken: request.cookies.get(guestCookieName(groupId))?.value ?? null,
      };
}
