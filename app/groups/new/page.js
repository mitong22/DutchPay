import { redirect } from "next/navigation";

import AuthenticatedApp from "@/component/authenticatedApp";
import { MOCK_CAPTAIN } from "@/lib/mockCaptain";
import { hasMockSession } from "@/lib/mockPageAuth";

export default async function NewGroup() {
  if (!(await hasMockSession())) {
    redirect("/login");
  }

  return <AuthenticatedApp captain={MOCK_CAPTAIN} page="create" />;
}
