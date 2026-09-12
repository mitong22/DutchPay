const LEGACY_GUEST_COOKIE = "dutchpay_guest";
export const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

// ponytail: 모임별 쿠키로 분리한다. 수십 개 모임을 동시에 유지해야 하면 브라우저 세션 하나로 통합한다.
export function guestCookieName(groupId) {
  return `${LEGACY_GUEST_COOKIE}_${encodeURIComponent(groupId)}`;
}

// Teacher: 모임별 쿠키가 없으면 예전 공통 쿠키를 읽는 호환 처리입니다. 쿠키 토큰 → 서버의 해시 비교 → guest_session.member_id → 참여자 조회를 연결하고, 문자열 ID만 아는 것과 인증을 구분해 보기.
export function getGuestToken(cookieStore, groupId) {
  return cookieStore.get(guestCookieName(groupId))?.value
    ?? cookieStore.get(LEGACY_GUEST_COOKIE)?.value;
}
