import { redirect } from "next/navigation";

import LoginPage from "@/component/pages/loginPage";
import { MOCK_CAPTAIN } from "@/lib/mockCaptain";
import { hasMockSession } from "@/lib/mockPageAuth";

export default async function Login() {
  if (await hasMockSession()) {
    redirect("/dashboard");
  }

  return <LoginPage captain={MOCK_CAPTAIN} />;
}
