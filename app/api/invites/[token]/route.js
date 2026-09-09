import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import {
  errorResponse,
  joinGroup,
} from "@/lib/groups";
import { guestCookieName, GUEST_COOKIE_MAX_AGE } from "@/lib/guest-session.mjs";

export async function POST(request, { params }) {
  try {
    const { token } = await params;
    const input = await request.json();
    const session = await auth.api.getSession({ headers: request.headers });
    const result = await joinGroup(token, input.nickname, session?.user?.id);
    const response = NextResponse.json({ groupId: result.groupId });
    if (result.guestToken) {
      response.cookies.set(guestCookieName(result.groupId), result.guestToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: GUEST_COOKIE_MAX_AGE,
      });
    }
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
