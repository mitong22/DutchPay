import { redirect } from "next/navigation";

import AuthenticatedApp from "@/component/authenticatedApp";
import { getPageGroupView } from "@/lib/pageGroupView";

export default async function GroupDetail({ params }) {
  const { groupId } = await params;
  const view = await getPageGroupView(groupId);

  if (!view) redirect("/login");

  return (
    <AuthenticatedApp
      captain={view.captain}
      groups={[view.group]}
      page="group"
      groupId={groupId}
      viewer={view.viewer}
    />
  );
}
