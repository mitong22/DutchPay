// ponytail: 단일 테스트 계정용 고정 세션이다. 실제 계정 단계에서 Better Auth 세션으로 교체한다.
export const MOCK_ACCOUNT_COOKIE = "dutchpay_mock_user";
export const MOCK_LOGIN_ID = "1234";
export const MOCK_LOGIN_PASSWORD = "1234";

export function isValidMockLogin(loginId, password) {
  return loginId === MOCK_LOGIN_ID && password === MOCK_LOGIN_PASSWORD;
}
