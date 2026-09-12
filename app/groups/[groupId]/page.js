import { redirect } from "next/navigation";

import AuthenticatedApp from "@/component/authenticatedApp";
import { getPageGroupView } from "@/lib/pageGroupView";

// Teacher: 이 브랜치 AGENTS.md에는 수업별 제약이 없습니다. page → getPageGroupView → DB → AuthenticatedApp 흐름을 따라가고, 수업의 최소 Client 영역·폼 Action 방식과 현재 화면 분리 범위를 비교해 보기.
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
