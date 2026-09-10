import { redirect } from "next/navigation";

import AuthenticatedApp from "@/component/authenticatedApp";
import { getGroup } from "@/lib/groups";
import { MOCK_CAPTAIN } from "@/lib/mockCaptain";
import { hasMockSession } from "@/lib/mockPageAuth";

export default async function GroupDetail({ params }) {
  if (!(await hasMockSession())) {
    redirect("/login");
  }

  const { groupId } = await params;
  const group = await getGroup(groupId, MOCK_CAPTAIN.user_id);

  return (
    <AuthenticatedApp
      captain={MOCK_CAPTAIN}
      groups={group ? [group] : []}
      page="group"
      groupId={groupId}
    />
  );
}
