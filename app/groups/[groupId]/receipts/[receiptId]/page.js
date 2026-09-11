import { redirect } from "next/navigation";

import AuthenticatedApp from "@/component/authenticatedApp";
import { getPageGroupView } from "@/lib/pageGroupView";

export default async function ReceiptDetail({ params }) {
  const { groupId, receiptId } = await params;
  const view = await getPageGroupView(groupId);

  if (!view) redirect("/login");

  return (
    <AuthenticatedApp
      captain={view.captain}
      groups={[view.group]}
      page="receipt"
      groupId={groupId}
      receiptId={receiptId}
      viewer={view.viewer}
    />
  );
}
