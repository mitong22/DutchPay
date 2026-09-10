import { redirect } from "next/navigation";

import AuthenticatedApp from "@/component/authenticatedApp";
import { MOCK_CAPTAIN } from "@/lib/mockCaptain";
import { hasMockSession } from "@/lib/mockPageAuth";

export default async function ReceiptDetail({ params }) {
  if (!(await hasMockSession())) {
    redirect("/login");
  }

  const { groupId, receiptId } = await params;

  return (
    <AuthenticatedApp
      captain={MOCK_CAPTAIN}
      page="receipt"
      groupId={groupId}
      receiptId={receiptId}
    />
  );
}
