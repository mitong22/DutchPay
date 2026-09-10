import { MOCK_CAPTAIN } from "@/lib/mockCaptain";
import { MOCK_ACCOUNT_COOKIE } from "@/lib/mockSession.mjs";
import {
  completeGroup,
  getGroup,
  groupErrorResponse,
} from "@/lib/groups";

function getCaptain(request) {
  return request.cookies.get(MOCK_ACCOUNT_COOKIE)?.value ===
    MOCK_CAPTAIN.user_id
    ? MOCK_CAPTAIN
    : null;
}

export async function GET(request, { params }) {
  const captain = getCaptain(request);

  if (!captain) {
    return Response.json({ message: "로그인이 필요해요." }, { status: 401 });
  }

  try {
    const { groupId } = await params;
    const group = await getGroup(groupId, captain.user_id);

    return group
      ? Response.json({ group })
      : Response.json({ message: "모임을 찾을 수 없어요." }, { status: 404 });
  } catch (error) {
    return groupErrorResponse(error);
  }
}

export async function PATCH(request, { params }) {
  const captain = getCaptain(request);

  if (!captain) {
    return Response.json({ message: "로그인이 필요해요." }, { status: 401 });
  }

  try {
    const [{ groupId }, input] = await Promise.all([
      params,
      request.json().catch(() => null),
    ]);

    if (input?.status !== "COMPLETED") {
      return Response.json(
        { message: "지원하지 않는 모임 변경이에요." },
        { status: 400 },
      );
    }

    return Response.json({
      group: await completeGroup(groupId, captain.user_id),
    });
  } catch (error) {
    return groupErrorResponse(error);
  }
}
