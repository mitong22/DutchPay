import { connection } from "next/server";

import InviteClient from "@/component/InviteClient";
import { getInvitePreview } from "@/lib/groups";

export default async function InvitePage({ params }) {
  await connection();
  const { token } = await params;
  const preview = await getInvitePreview(token);

  return <InviteClient token={token} preview={preview} />;
}
