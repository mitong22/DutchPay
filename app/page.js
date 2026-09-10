import { redirect } from "next/navigation";

import { hasMockSession } from "@/lib/mockPageAuth";

export default async function Home({ searchParams }) {
  const inviteValue = (await searchParams).invite;
  const inviteToken = Array.isArray(inviteValue) ? inviteValue[0] : inviteValue;

  if (inviteToken) {
    redirect(`/invite/${encodeURIComponent(inviteToken)}`);
  }

  redirect((await hasMockSession()) ? "/dashboard" : "/login");
}
