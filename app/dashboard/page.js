import { redirect } from "next/navigation";

import AuthenticatedApp from "@/component/authenticatedApp";
import { listGroups } from "@/lib/groups";
import { MOCK_CAPTAIN } from "@/lib/mockCaptain";
import { hasMockSession } from "@/lib/mockPageAuth";

export default async function Dashboard() {
  if (!(await hasMockSession())) {
    redirect("/login");
  }

  const groups = await listGroups(MOCK_CAPTAIN.user_id);

  return (
    <AuthenticatedApp
      captain={MOCK_CAPTAIN}
      groups={groups}
      page="dashboard"
    />
  );
}
