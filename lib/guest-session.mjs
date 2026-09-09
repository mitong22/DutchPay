const LEGACY_GUEST_COOKIE = "dutchpay_guest";
export const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

// ponytail: 모임별 쿠키로 분리한다. 수십 개 모임을 동시에 유지해야 하면 브라우저 세션 하나로 통합한다.
export function guestCookieName(groupId) {
  return `${LEGACY_GUEST_COOKIE}_${encodeURIComponent(groupId)}`;
}

export function getGuestToken(cookieStore, groupId) {
  return cookieStore.get(guestCookieName(groupId))?.value
    ?? cookieStore.get(LEGACY_GUEST_COOKIE)?.value;
}
