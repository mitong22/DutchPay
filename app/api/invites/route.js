import { NextResponse } from "next/server";

import {
  activateInvite,
  createInvite,
  getInvite,
  getInviteGroupId,
  joinInvite,
  removeInviteParticipant,
} from "@/lib/invites";
import { GUEST_COOKIE_MAX_AGE, guestCookieName } from "@/lib/inviteTokens.mjs";
import { groupErrorResponse } from "@/lib/groups";
import { getGroupCredentials, getRequestUser } from "@/lib/apiAuth";

const COOKIE_OPTIONS = {
  httpOnly: true,
  maxAge: GUEST_COOKIE_MAX_AGE,
  path: "/",
  sameSite: "lax",
};

async function readBody(request) {
  return request.json().catch(() => null);
}

function readToken(body) {
  return typeof body?.token === "string" ? body.token : "";
}

export async function POST(request) {
  const captain = await getRequestUser(request);

  if (!captain) {
    return Response.json({ message: "로그인이 필요해요." }, { status: 401 });
  }

  try {
    const input = await readBody(request);
    const invite = await createInvite(
      { id: captain.user_id, nickname: captain.nickname },
      input,
    );

    return Response.json({ invite }, { status: 201 });
  } catch (error) {
    return groupErrorResponse(error);
  }
}

export async function GET(request) {
  try {
    const token = request.nextUrl.searchParams.get("token") ?? "";
    const groupId = await getInviteGroupId(token);
    const invite = await getInvite(
      token,
      await getGroupCredentials(request, groupId),
    );

    return Response.json({ invite });
  } catch (error) {
    return groupErrorResponse(error);
  }
}

export async function PATCH(request) {
  try {
    const body = await readBody(request);
    const token = readToken(body);
    const groupId = await getInviteGroupId(token);
    const result = await joinInvite(
      token,
      body?.nickname,
      await getGroupCredentials(request, groupId),
    );
    const response = NextResponse.json({
      invite: result.invite,
      created: result.created,
    });

    if (result.guestToken) {
      response.cookies.set(
        guestCookieName(groupId),
        result.guestToken,
        COOKIE_OPTIONS,
      );
    }

    return response;
  } catch (error) {
    return groupErrorResponse(error);
  }
}

export async function DELETE(request) {
  const captain = await getRequestUser(request);

  if (!captain) {
    return Response.json({ message: "로그인이 필요해요." }, { status: 401 });
  }

  try {
    const body = await readBody(request);
    const invite = await removeInviteParticipant(
      readToken(body),
      body?.memberId,
      captain.user_id,
    );

    return Response.json({ invite });
  } catch (error) {
    return groupErrorResponse(error);
  }
}

export async function PUT(request) {
  const captain = await getRequestUser(request);

  if (!captain) {
    return Response.json({ message: "로그인이 필요해요." }, { status: 401 });
  }

  try {
    const body = await readBody(request);
    const invite = await activateInvite(readToken(body), captain.user_id);

    return Response.json({ invite });
  } catch (error) {
    return groupErrorResponse(error);
  }
}
