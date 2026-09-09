import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import BoardClient from "@/component/BoardClient";
import { getSession } from "@/lib/auth";
import { getGroupBoard } from "@/lib/groups";
import { getGuestToken } from "@/lib/guest-session.mjs";

export default async function GroupPage({ params }) {
  await connection();
  const { groupId } = await params;
  const [session, cookieStore] = await Promise.all([getSession(), cookies()]);
  let board;

  try {
    board = await getGroupBoard(groupId, {
      userId: session?.user?.id,
      guestToken: getGuestToken(cookieStore, groupId),
    });
  } catch (error) {
    if ([401, 403, 404].includes(error.status)) notFound();
    throw error;
  }

  return <BoardClient initialBoard={board} />;
}
