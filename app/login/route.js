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
  for (const cookie of authResponse.headers.getSetCookie()) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}
