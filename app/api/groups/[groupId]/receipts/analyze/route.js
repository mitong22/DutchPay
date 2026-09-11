import { getGroupCredentials } from "@/lib/apiAuth";
import {
  getGroupViewer,
  groupErrorResponse,
  requireActiveGroup,
} from "@/lib/groups";
import {
  analyzeReceiptImage,
  MAX_RECEIPT_IMAGE_BYTES,
} from "@/lib/receiptOcr.mjs";

export const runtime = "nodejs";
export const maxDuration = 190;

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export async function POST(request, { params }) {
  try {
    const { groupId } = await params;
    const viewer = await getGroupViewer(
      groupId,
      await getGroupCredentials(request, groupId),
    );
    requireActiveGroup(viewer);

    const contentLength = Number(request.headers.get("content-length"));

    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_RECEIPT_IMAGE_BYTES + 1024 * 1024
    ) {
      fail(413, "영수증 사진은 10MB 이하만 올릴 수 있어요.");
    }

    const formData = await request.formData().catch(() => null);

    if (!formData) {
      fail(400, "영수증 사진 요청을 읽을 수 없어요.");
    }

    const result = await analyzeReceiptImage({
      file: formData.get("receipt"),
      groupId: viewer.group._id,
      inputMethod: formData.get("input_method"),
      signal: request.signal,
    });

    return Response.json(result);
  } catch (error) {
    return groupErrorResponse(error);
  }
}
