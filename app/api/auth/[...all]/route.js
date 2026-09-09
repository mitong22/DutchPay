function loginNotImplemented() {
  return Response.json(
    { message: "로그인 기능은 목업 총대 테스트 이후 단계에서 구현합니다." },
    { status: 501 },
  );
}

export const GET = loginNotImplemented;
export const POST = loginNotImplemented;
