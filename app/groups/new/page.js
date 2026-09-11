import { redirect } from "next/navigation";

import AuthenticatedApp from "@/component/authenticatedApp";
import { getCurrentUser } from "@/lib/auth";

export default async function NewGroup() {
  const captain = await getCurrentUser();

  if (!captain) redirect("/login");

  return <AuthenticatedApp captain={captain} page="create" />;
}
