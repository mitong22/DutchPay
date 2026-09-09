import "server-only";

import { cookies } from "next/headers";

import { ApplicationError } from "@/lib/application-error";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashSecureToken } from "@/lib/secure-token";

export const GUEST_SESSION_COOKIE_NAME = "dutchpay_guest_session";

export async function requireRegisteredSession() {
  const session = await getSession();

  if (!session?.user?.id) {
    throw new ApplicationError(
      "로그인이 필요한 기능입니다.",
      "AUTHENTICATION_REQUIRED",
    );
  }

  return session;
}

async function findGuestAuthentication(groupId) {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(GUEST_SESSION_COOKIE_NAME)?.value;

  if (!rawToken) {
    return null;
  }

  const guestSession = await db.collection("guest_session").findOne({
    group_id: groupId,
    token_hash: hashSecureToken(rawToken),
    expires_at: { $gt: new Date() },
  });

  if (!guestSession) {
    return null;
  }

  const member = await db.collection("group_member").findOne({
    _id: guestSession.member_id,
    group_id: groupId,
  });

  if (!member) {
    return null;
  }

  return {
    member,
    authenticationType: "guest",
    registeredSession: null,
  };
}

export async function getCurrentGroupMember(groupId) {
  if (typeof groupId !== "string" || groupId.length === 0) {
    return null;
  }

  const registeredSession = await getSession();

  if (registeredSession?.user?.id) {
    const member = await db.collection("group_member").findOne({
      group_id: groupId,
      user_id: String(registeredSession.user.id),
      member_type: "registered",
    });

    if (member) {
      return {
        member,
        authenticationType: "registered",
        registeredSession,
      };
    }
  }

  return findGuestAuthentication(groupId);
}

export async function getGroupContext(groupId) {
  const [group, authentication] = await Promise.all([
    db.collection("expense_group").findOne({ _id: groupId }),
    getCurrentGroupMember(groupId),
  ]);

  if (!group || !authentication) {
    return null;
  }

  const isOwner =
    authentication.member.member_type === "registered" &&
    authentication.member.user_id === group.created_by;

  return {
    group,
    member: authentication.member,
    authenticationType: authentication.authenticationType,
    registeredSession: authentication.registeredSession,
    isOwner,
  };
}

export async function requireGroupContext(groupId) {
  const context = await getGroupContext(groupId);

  if (!context) {
    throw new ApplicationError(
      "이 모임에 접근할 권한이 없습니다.",
      "GROUP_ACCESS_DENIED",
    );
  }

  return context;
}

export async function setGuestSessionCookie(rawToken, expiresAt) {
  const cookieStore = await cookies();

  cookieStore.set(GUEST_SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearGuestSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(GUEST_SESSION_COOKIE_NAME);
}
