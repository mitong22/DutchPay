import { deleteReceipt, groupErrorResponse, saveReceipt } from "@/lib/groups";
import { getGroupCredentials } from "@/lib/apiAuth";

export async function PATCH(request, { params }) {
  try {
    const [{ groupId, receiptId }, input] = await Promise.all([
      params,
      request.json().catch(() => null),
    ]);
    const savedReceiptId = await saveReceipt(
      groupId,
      await getGroupCredentials(request, groupId),
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
      await getGroupCredentials(request, groupId),
    );

    return new Response(null, { status: 204 });
  } catch (error) {
    return groupErrorResponse(error);
  }
}
