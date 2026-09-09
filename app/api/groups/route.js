import { auth } from "@/lib/auth";
import { createGroup, errorResponse } from "@/lib/groups";

export async function POST(request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const input = await request.json();
    const result = await createGroup(session.user, input);
    const invitePaths = result.inviteTokens.map((token) => `/invite/${token}`);
    return Response.json(
      {
        groupId: result.groupId,
        invitePaths,
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
