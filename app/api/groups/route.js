import {
  createGroup,
  groupErrorResponse,
  listGroups,
} from "@/lib/groups";
import { getMockCaptain } from "@/lib/mockApiAuth";

export async function GET(request) {
  const captain = getMockCaptain(request);

  if (!captain) {
    return Response.json({ message: "로그인이 필요해요." }, { status: 401 });
  }

  try {
    return Response.json({ groups: await listGroups(captain.user_id) });
  } catch (error) {
    return groupErrorResponse(error);
  }
}

export async function POST(request) {
  const captain = getMockCaptain(request);

  if (!captain) {
    return Response.json({ message: "로그인이 필요해요." }, { status: 401 });
  }

  try {
    const input = await request.json().catch(() => null);
    const group = await createGroup(
      { id: captain.user_id, nickname: captain.nickname },
      input,
    );

    return Response.json({ group }, { status: 201 });
  } catch (error) {
    return groupErrorResponse(error);
  }
}
