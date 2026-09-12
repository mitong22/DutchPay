import { cookies } from "next/headers";

import { auth } from "@/lib/auth";
import {
  completeSettlement,
  createInvites,
  deleteReceipt,
  errorResponse,
  getGroupViewer,
  requireActiveGroup,
  saveReceipt,
  setPaymentStatus,
} from "@/lib/groups";
import { getGuestToken } from "@/lib/guest-session.mjs";

// Teacher: 하나의 POST가 input.action에 따라 저장·삭제·상태 변경·초대를 처리합니다. 기능별 권한 검사가 어느 lib 함수에 있는지 표로 정리하고, 독립 Server Action으로 나누면 읽기 쉬워지는지 AI와 비교해 보기.
export async function POST(request, { params }) {
  try {
    const { groupId } = await params;
    const [session, cookieStore] = await Promise.all([
      auth.api.getSession({ headers: request.headers }),
      cookies(),
    ]);
    const viewer = await getGroupViewer(groupId, {
      userId: session?.user?.id,
      guestToken: getGuestToken(cookieStore, groupId),
    });
    const input = await request.json();

    if (["saveReceipt", "deleteReceipt", "setPaymentStatus"].includes(input.action)) {
      requireActiveGroup(viewer);
    }

    if (input.action === "saveReceipt") {
      const receiptId = await saveReceipt(groupId, input.receipt ?? {}, viewer);
      return Response.json({ receiptId });
    }
    if (input.action === "deleteReceipt") {
      await deleteReceipt(groupId, input.receiptId, viewer);
      return Response.json({ ok: true });
    }
    if (input.action === "setPaymentStatus") {
      await setPaymentStatus(
        groupId,
        input.paymentId,
        input.status,
        viewer,
      );
      return Response.json({ ok: true });
    }
    if (input.action === "completeSettlement") {
      await completeSettlement(groupId, viewer);
      return Response.json({ ok: true });
    }
    if (input.action === "createInvites") {
      const tokens = await createInvites(groupId, viewer);
      return Response.json({
        invitePaths: tokens.map((token) => `/invite/${token}`),
      });
    }

    return Response.json({ error: "지원하지 않는 작업입니다." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
