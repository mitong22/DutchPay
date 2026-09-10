import { redirect } from "next/navigation";

import AuthenticatedApp from "@/component/authenticatedApp";
import { getGroup } from "@/lib/groups";
import { MOCK_CAPTAIN } from "@/lib/mockCaptain";
import { hasMockSession } from "@/lib/mockPageAuth";

export default async function ReceiptDetail({ params }) {
  if (!(await hasMockSession())) {
    redirect("/login");
  }

  const { groupId, receiptId } = await params;
  const group = await getGroup(groupId, MOCK_CAPTAIN.user_id);

  return (
    <AuthenticatedApp
      captain={MOCK_CAPTAIN}
      groups={group ? [group] : []}
      page="receipt"
      groupId={groupId}
      receiptId={receiptId}
    />
  );
}
