import { redirect } from "next/navigation";

import AuthenticatedApp from "@/component/authenticatedApp";
import { MOCK_CAPTAIN } from "@/lib/mockCaptain";
import { getPageGroupView } from "@/lib/pageGroupView";

export default async function ReceiptDetail({ params }) {
  const { groupId, receiptId } = await params;
  const view = await getPageGroupView(groupId);

  if (!view) redirect("/login");

  return (
    <AuthenticatedApp
      captain={MOCK_CAPTAIN}
      groups={[view.group]}
      page="receipt"
      groupId={groupId}
      receiptId={receiptId}
      viewer={view.viewer}
    />
  );
}
