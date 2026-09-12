import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

import { auth } from "@/lib/auth";
import { parseClovaReceipt } from "@/lib/clova-ocr.mjs";
import {
  errorResponse,
  getGroupViewer,
  requireActiveGroup,
} from "@/lib/groups";
import { getGuestToken } from "@/lib/guest-session.mjs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const FORMATS = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
]);
function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export async function POST(request) {
  try {
    const groupId = new URL(request.url).searchParams.get("groupId");
    if (!groupId || groupId.length > 100) fail(400, "모임 정보가 올바르지 않습니다.");

    const [session, cookieStore] = await Promise.all([
      auth.api.getSession({ headers: request.headers }),
      cookies(),
    ]);
    const viewer = await getGroupViewer(groupId, {
      userId: session?.user?.id,
      guestToken: getGuestToken(cookieStore, groupId),
    });
    requireActiveGroup(viewer);

    if (Number(request.headers.get("content-length") || 0) > MAX_FILE_SIZE + 100_000) {
      fail(413, "사진은 10MB 이하여야 합니다.");
    }
    const requestForm = await request.formData();
    const file = requestForm.get("file");
    const source = String(requestForm.get("source") ?? "camera");
    if (!(file instanceof File) || !file.size) fail(400, "영수증 사진을 선택해 주세요.");
    if (file.size > MAX_FILE_SIZE) fail(413, "사진은 10MB 이하여야 합니다.");
    if (!["camera", "photo"].includes(source)) fail(400, "사진 입력 방식이 올바르지 않습니다.");

    const format = FORMATS.get(file.type);
    if (!format) fail(415, "JPG 또는 PNG 영수증만 인식할 수 있습니다.");

    // Teacher: 사진은 브라우저 → 이 서버 → 외부 OCR로 전달되고 비밀키는 서버에서 붙입니다. FormData와 JSON 요청의 차이, OCR 결과가 즉시 DB 저장되는지 또는 편집 초안으로 돌아가는지를 구분해 보기.
    const invokeUrl = process.env.CLOVA_OCR_INVOKE_URL;
    const secret = process.env.CLOVA_OCR_SECRET;
    if (!invokeUrl || !secret) {
      fail(503, "CLOVA OCR 연결 정보가 아직 설정되지 않았어요.");
    }
    let endpoint;
    try {
      endpoint = new URL(invokeUrl);
    } catch {
      fail(500, "CLOVA OCR Invoke URL 설정이 올바르지 않습니다.");
    }
    if (endpoint.protocol !== "https:") {
      fail(500, "CLOVA OCR Invoke URL은 HTTPS여야 합니다.");
    }

    const body = new FormData();
    body.append("file", file, file.name);
    body.append("message", JSON.stringify({
      version: "V2",
      requestId: randomUUID(),
      timestamp: Date.now(),
      images: [{ format, name: "receipt" }],
    }));

    let response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "X-OCR-SECRET": secret },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      if (error.name === "TimeoutError") fail(504, "OCR 응답 시간이 초과됐어요. 다시 시도해 주세요.");
      throw error;
    }
    if (!response.ok) {
      console.error("CLOVA OCR failed:", response.status);
      fail(502, "CLOVA OCR 요청에 실패했어요. 연결 정보를 확인해 주세요.");
    }

    let receipt;
    try {
      receipt = parseClovaReceipt(await response.json());
    } catch (error) {
      fail(422, error.message);
    }
    return Response.json(receipt);
  } catch (error) {
    return errorResponse(error);
  }
}
