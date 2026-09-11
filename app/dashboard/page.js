import { redirect } from "next/navigation";

import AuthenticatedApp from "@/component/authenticatedApp";
import { getCurrentUser } from "@/lib/auth";
import { listGroups } from "@/lib/groups";

export default async function Dashboard() {
  // 1. 로그인한 회원을 총대로 지정 후 빈 값이면 로그인 페이지로 이동
  const captain = await getCurrentUser();
  if (!captain) redirect("/login");

  // 2. 본인이 총대인 모임 불러오기
  const groups = await listGroups(captain.user_id);

  return (
    <AuthenticatedApp // 3. 인증 페이지로 분기

      // ***** 회원이지만 총대가 아닌 모임원으로 참여하는 경우 이 값을 넘겨줘도 되는지 체크
      captain={captain} // 총대 정보
      groups={groups} // 그룹 정보
      page="dashboard"
    />
  );
}
