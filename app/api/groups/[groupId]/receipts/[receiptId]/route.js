import { deleteReceipt, groupErrorResponse, saveReceipt } from "@/lib/groups";
import { getGroupCredentials } from "@/lib/mockApiAuth";

export async function PATCH(request, { params }) {
  try {
    const [{ groupId, receiptId }, input] = await Promise.all([
      params,
      request.json().catch(() => null),
    ]);
    const savedReceiptId = await saveReceipt(
      groupId,
      getGroupCredentials(request, groupId),
      { ...input, id: receiptId },
    );

    return Response.json({ receiptId: savedReceiptId });
  } catch (error) {
    return groupErrorResponse(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { groupId, receiptId } = await params;
    await deleteReceipt(
      groupId,
      receiptId,
      getGroupCredentials(request, groupId),
    );

    return new Response(null, { status: 204 });
  } catch (error) {
    return groupErrorResponse(error);
  }
}
