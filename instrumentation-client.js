import { reportClientError } from "@/lib/client-log.mjs";

// Teacher: 일반 컴포넌트가 아닌 브라우저 계측 진입점입니다. error·unhandledrejection → sendBeacon → 개발용 로그 API 흐름을 찾아보고, 이 이벤트로 서버 오류까지 모두 잡을 수 있는지 구분해 보기.
try {
  window.addEventListener("error", (event) => {
    if (event.error || event.message) {
      reportClientError(event.error ?? event.message, "window.error");
    }
  });
  window.addEventListener("unhandledrejection", (event) => {
    reportClientError(event.reason, "window.unhandledrejection");
  });
} catch (error) {
  console.error("[client-logger-setup]", error);
}
