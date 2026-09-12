import "server-only";

import { randomUUID } from "node:crypto";

import { ApplicationError } from "@/lib/application-error";
import { db, runInTransaction } from "@/lib/db";
import { shouldActivateTogetherGroup } from "@/lib/group-rules.mjs";
import { createGuestSessionExpirationDate } from "@/lib/runtime-config";
import { createSecureToken, hashSecureToken } from "@/lib/secure-token";

function normalizeNickname(nickname) {
  if (typeof nickname !== "string") {
    throw new ApplicationError("별명을 입력해 주세요.");
  }

  const normalizedNickname = nickname.trim();

  if (normalizedNickname.length === 0 || normalizedNickname.length > 30) {
    throw new ApplicationError("별명은 1자 이상 30자 이하로 입력해 주세요.");
  }

  return normalizedNickname;
}

export async function getInvitePreview(rawToken) {
  if (typeof rawToken !== "string" || rawToken.length === 0) {
    return null;
  }

  const invite = await db.collection("invite").findOne({
    token_hash: hashSecureToken(rawToken),
  });

  if (!invite) {
    return null;
  }

  const [group, member] = await Promise.all([
    db.collection("expense_group").findOne({ _id: invite.group_id }),
    invite.member_id
      ? db.collection("group_member").findOne({
          _id: invite.member_id,
          group_id: invite.group_id,
        })
      : Promise.resolve(null),
  ]);

  if (!group) {
    return null;
  }

  return {
    invite,
    group,
    member,
    isUsable:
      invite.status === "ACTIVE" && invite.expires_at.getTime() > Date.now(),
  };
}

export async function claimInvite({ rawToken, nickname }) {
  const tokenHash = hashSecureToken(rawToken);
  const rawGuestSessionToken = createSecureToken();
  const guestSessionId = randomUUID();
  const now = new Date();
  const guestSessionExpiresAt = createGuestSessionExpirationDate(now);
  let claimedGroupId = null;
  let claimedMemberId = null;

  await runInTransaction(async (session) => {
    const invite = await db.collection("invite").findOne(
      {
        token_hash: tokenHash,
        status: "ACTIVE",
        expires_at: { $gt: now },
      },
      { session },
    );

    if (!invite) {
      throw new ApplicationError("유효하지 않거나 만료된 초대 링크입니다.");
    }

    const group = await db.collection("expense_group").findOne(
      { _id: invite.group_id, mode: "TOGETHER" },
      { session },
    );

    if (!group) {
      throw new ApplicationError("초대된 모임을 찾을 수 없습니다.");
    }

    claimedGroupId = group._id;

    // Teacher: 이 브랜치는 유효한 초대를 다시 열면 기존 group_member를 이어받고 guest_session을 새로 발급합니다. 회원 ID는 정산 기록의 주인이고 세션 ID는 접속 인증 기록이므로 같게 만들면 안 됩니다. AGENTS.md의 guest_session.member_id 규칙을 실제 두 문서의 예시로 연결해 보세요.
    if (invite.member_id) {
      const existingMember = await db.collection("group_member").findOne(
        { _id: invite.member_id, group_id: group._id },
        { session },
      );

      if (!existingMember) {
        throw new ApplicationError("초대 참여자 정보를 찾을 수 없습니다.");
      }

      claimedMemberId = existingMember._id;
    } else {
      const normalizedNickname = normalizeNickname(nickname);
      const joinedMemberCount = await db
        .collection("group_member")
        .countDocuments({ group_id: group._id }, { session });

      if (joinedMemberCount >= group.expected_member_count) {
        throw new ApplicationError("이미 모든 참여자가 입장한 모임입니다.");
      }

      const duplicateNickname = await db.collection("group_member").findOne(
        { group_id: group._id, nickname: normalizedNickname },
        { session },
      );

      if (duplicateNickname) {
        throw new ApplicationError("이미 사용 중인 별명입니다.");
      }

      claimedMemberId = randomUUID();
      // Teacher: 조회 후 수정 사이에 다른 요청이 끼어들 수 있습니다. updateOne 조건에도 member_id: null과 만료 조건을 넣고 modifiedCount를 확인하는 이유를 같은 초대 링크 동시 접속 예제로 설명해 보세요. 트랜잭션 안의 읽기·쓰기에는 모두 같은 session이 전달되는지도 확인하세요.
      const inviteUpdate = await db.collection("invite").updateOne(
        {
          _id: invite._id,
          status: "ACTIVE",
          member_id: null,
          expires_at: { $gt: now },
        },
        {
          $set: {
            member_id: claimedMemberId,
            claimed_at: now,
          },
        },
        { session },
      );

      if (inviteUpdate.modifiedCount !== 1) {
        throw new ApplicationError("다른 참여자가 먼저 사용한 초대 링크입니다.");
      }

      await db.collection("group_member").insertOne(
        {
          _id: claimedMemberId,
          group_id: group._id,
          user_id: null,
          nickname: normalizedNickname,
          member_type: "guest",
        },
        { session },
      );

      const nextJoinedMemberCount = joinedMemberCount + 1;

      if (
        shouldActivateTogetherGroup({
          mode: group.mode,
          status: group.status,
          expectedMemberCount: group.expected_member_count,
          joinedMemberCount: nextJoinedMemberCount,
        })
      ) {
        await db.collection("expense_group").updateOne(
          { _id: group._id, status: "WAITING" },
          {
            $set: {
              status: "ACTIVE",
              activated_at: now,
              updated_at: now,
            },
          },
          { session },
        );
      }
    }

    await db.collection("guest_session").insertOne(
      {
        _id: guestSessionId,
        group_id: claimedGroupId,
        member_id: claimedMemberId,
        token_hash: hashSecureToken(rawGuestSessionToken),
        expires_at: guestSessionExpiresAt,
        created_at: now,
      },
      { session },
    );
  });

  return {
    groupId: claimedGroupId,
    memberId: claimedMemberId,
    rawGuestSessionToken,
    expiresAt: guestSessionExpiresAt,
  };
}
