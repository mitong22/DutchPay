import { redirect } from "next/navigation";

import LoginPage from "@/component/pages/loginPage";
import { getCurrentUser } from "@/lib/auth";

export default async function Login() {
  if (await getCurrentUser()) {
    redirect("/dashboard");
  }

  return <LoginPage />;
}
