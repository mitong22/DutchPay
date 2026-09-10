import InvitePage from "@/component/pages/invitePage";

export default async function Invite({ params }) {
  const { token } = await params;

  return <InvitePage inviteToken={token} />;
}
