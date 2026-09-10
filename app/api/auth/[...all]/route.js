// 운영 로그인 전환 예시:
// import { toNextJsHandler } from "better-auth/next-js";
// import { auth } from "@/lib/auth";
// export const { GET, POST } = toNextJsHandler(auth);
// 위 handler를 연결하면 로그인 정보와 세션은 브라우저가 아니라 MongoDB에 저장된다.
function loginNotImplemented() {
  return Response.json(
    { message: "로그인 기능은 목업 총대 테스트 이후 단계에서 구현합니다." },
    { status: 501 },
  );
}

export const GET = loginNotImplemented;
export const POST = loginNotImplemented;
