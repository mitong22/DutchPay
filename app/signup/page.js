import { redirect } from "next/navigation";
import { connection } from "next/server";

import SignupForm from "@/app/signup/signup-form";
import { getSession } from "@/lib/auth";

export const metadata = {
  title: "회원가입",
};

export default async function SignupPage() {
  await connection();
  const session = await getSession();

  if (session?.user) {
    redirect("/");
  }

  return (
    <main className="signup-page page-shell">
      <SignupForm />
    </main>
  );
}
