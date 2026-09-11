import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

export default async function Home({ searchParams }) {
  const inviteValue = (await searchParams).invite;
  const inviteToken = Array.isArray(inviteValue) ? inviteValue[0] : inviteValue;

  if (inviteToken) {
    redirect(`/invite/${encodeURIComponent(inviteToken)}`);
  }

  redirect((await getCurrentUser()) ? "/dashboard" : "/login");
}
