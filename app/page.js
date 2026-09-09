import ModeSelector from "@/component/modeSelector";
import { MOCK_CAPTAIN } from "@/lib/mockCaptain";

export default async function Home({ searchParams }) {
  const inviteValue = (await searchParams).invite;
  const inviteToken = Array.isArray(inviteValue)
    ? inviteValue[0]
    : inviteValue ?? "";

  return (
    <ModeSelector captain={MOCK_CAPTAIN} inviteToken={inviteToken} />
  );
}
