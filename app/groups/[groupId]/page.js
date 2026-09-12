import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import BoardClient from "@/component/BoardClient";
import { getSession } from "@/lib/auth";
import { getGroupBoard } from "@/lib/groups";
import { getGuestToken } from "@/lib/guest-session.mjs";

// Teacher: 이 브랜치 AGENTS.md에는 수업별 제약이 없습니다. Server에서 권한·초기 데이터를 읽고 큰 BoardClient로 넘기는 구조를 따라가며, 수업의 최소 Client 영역과 Server Action 폼 방식으로 나누는 안을 비교해 보기.
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
