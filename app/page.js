import { cookies } from "next/headers";

import ModeSelector from "@/component/modeSelector";
import { MOCK_CAPTAIN } from "@/lib/mockCaptain";
import { MOCK_ACCOUNT_COOKIE } from "@/lib/mockSession.mjs";

export default async function Home({ searchParams }) {
  const inviteValue = (await searchParams).invite;
  const inviteToken = Array.isArray(inviteValue)
    ? inviteValue[0]
    : inviteValue ?? "";
  const cookieStore = await cookies();
  const isAuthenticated =
    cookieStore.get(MOCK_ACCOUNT_COOKIE)?.value === MOCK_CAPTAIN.user_id;

  return (
    <ModeSelector
      captain={MOCK_CAPTAIN}
      inviteToken={inviteToken}
      isAuthenticated={isAuthenticated}
    />
  );
}
