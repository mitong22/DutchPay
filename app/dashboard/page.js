import { redirect } from "next/navigation";

import AuthenticatedApp from "@/component/authenticatedApp";
import { getCurrentUser } from "@/lib/auth";
import { listGroups } from "@/lib/groups";

export default async function Dashboard() {
  const captain = await getCurrentUser();

  if (!captain) redirect("/login");

  const groups = await listGroups(captain.user_id);

  return (
    <AuthenticatedApp
      captain={captain}
      groups={groups}
      page="dashboard"
    />
  );
}
