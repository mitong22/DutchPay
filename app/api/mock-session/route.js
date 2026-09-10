import { cookies } from "next/headers";

import { MOCK_CAPTAIN } from "@/lib/mockCaptain";
import {
  isValidMockLogin,
  MOCK_ACCOUNT_COOKIE,
} from "@/lib/mockSession.mjs";

// 운영 전환 시 이 고정 계정 API는 제거한다.
// app/api/auth/[...all]/route.js를 Better Auth handler로 연결하면
// 사용자와 세션은 Better Auth가 서버에서 검증하고 MongoDB에 저장한다.
const COOKIE_OPTIONS = {
  httpOnly: true,
  maxAge: 60 * 60 * 24 * 30,
  path: "/",
  sameSite: "lax",
};

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    body = null;
  }

  if (!isValidMockLogin(body?.loginId, body?.password)) {
    return Response.json(
      { message: "아이디 또는 비밀번호를 확인해 주세요." },
      { status: 401 },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(MOCK_ACCOUNT_COOKIE, MOCK_CAPTAIN.user_id, COOKIE_OPTIONS);

  return Response.json({ user: MOCK_CAPTAIN });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(MOCK_ACCOUNT_COOKIE);

  return Response.json({ success: true });
}
