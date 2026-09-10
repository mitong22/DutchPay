import { createHash, randomBytes } from "node:crypto";

export const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function createInviteToken() {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

export function guestCookieName(groupId) {
  return `dutchpay_guest_${String(groupId)}`;
}
