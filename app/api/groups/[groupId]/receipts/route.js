import { groupErrorResponse, saveReceipt } from "@/lib/groups";
import { getGroupCredentials } from "@/lib/mockApiAuth";

export async function POST(request, { params }) {
  try {
    const [{ groupId }, input] = await Promise.all([
      params,
      request.json().catch(() => null),
    ]);
    const receiptId = await saveReceipt(
      groupId,
      getGroupCredentials(request, groupId),
      { ...input, id: null, _id: null },
    );

    return Response.json({ receiptId }, { status: 201 });
  } catch (error) {
    return groupErrorResponse(error);
  }
}
