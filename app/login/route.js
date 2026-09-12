import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export async function POST(request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");

  if (!email || !password || email.length > 254 || password.length > 200) {
    return new NextResponse(null, {
      status: 303,
      headers: { location: "/?loginError=1" },
    });
  }

  const isDemo =
    process.env.NODE_ENV !== "production" &&
    email === "1" &&
    password === "1" &&
    process.env.DEMO_ACCOUNT_EMAIL &&
    process.env.DEMO_ACCOUNT_PASSWORD;

  const authResponse = await auth.api.signInEmail({
    body: isDemo
      ? {
          email: process.env.DEMO_ACCOUNT_EMAIL,
          password: process.env.DEMO_ACCOUNT_PASSWORD,
        }
      : { email, password },
    headers: request.headers,
    asResponse: true,
  });
  const response = new NextResponse(null, {
    status: 303,
    headers: { location: authResponse.ok ? "/" : "/?loginError=1" },
  });
  // Teacher: Better Auth가 만든 로그인 쿠키를 실제 브라우저 응답에 옮기는 부분입니다. 로그인 결과 객체만 반환하면 왜 세션이 유지되지 않을 수 있는지, 아래 응답의 303 이동과 함께 설명해 보기.
  for (const cookie of authResponse.headers.getSetCookie()) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}
