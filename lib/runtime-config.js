import "server-only";

export const INVITE_TOKEN_DURATION_DAYS = 7;
export const GUEST_SESSION_DURATION_DAYS = 7;

function createExpirationDate(durationDays, now) {
  const durationMilliseconds = durationDays * 24 * 60 * 60 * 1000;

  return new Date(now.getTime() + durationMilliseconds);
}

export function createInviteExpirationDate(now = new Date()) {
  return createExpirationDate(INVITE_TOKEN_DURATION_DAYS, now);
}

export function createGuestSessionExpirationDate(now = new Date()) {
  return createExpirationDate(GUEST_SESSION_DURATION_DAYS, now);
}
