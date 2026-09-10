import { redirect } from "next/navigation";

import AuthenticatedApp from "@/component/authenticatedApp";
import { MOCK_CAPTAIN } from "@/lib/mockCaptain";
import { hasMockSession } from "@/lib/mockPageAuth";

export default async function GroupDetail({ params }) {
  if (!(await hasMockSession())) {
    redirect("/login");
  }

  const { groupId } = await params;

  return (
    <AuthenticatedApp
      captain={MOCK_CAPTAIN}
      page="group"
      groupId={groupId}
    />
  );
}
