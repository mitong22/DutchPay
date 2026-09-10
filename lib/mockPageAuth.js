import { cookies } from "next/headers";

import { MOCK_CAPTAIN } from "@/lib/mockCaptain";
import { MOCK_ACCOUNT_COOKIE } from "@/lib/mockSession.mjs";

export async function hasMockSession() {
  const cookieStore = await cookies();

  return cookieStore.get(MOCK_ACCOUNT_COOKIE)?.value === MOCK_CAPTAIN.user_id;
}
