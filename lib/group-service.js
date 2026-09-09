import "server-only";

import { randomUUID } from "node:crypto";

import { ApplicationError } from "@/lib/application-error";
import { db, runInTransaction } from "@/lib/db";
import {
  GROUP_MODE,
  createInitialGroupState,
} from "@/lib/group-rules.mjs";
import { createInviteExpirationDate } from "@/lib/runtime-config";
import { createSecureToken, hashSecureToken } from "@/lib/secure-token";

const MAX_GROUP_MEMBER_COUNT = 50;

function normalizeText(value, fieldName, maximumLength) {
  if (typeof value !== "string") {
    throw new ApplicationError(`${fieldName}을 입력해 주세요.`);
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length === 0 || normalizedValue.length > maximumLength) {
    throw new ApplicationError(
      `${fieldName}은 1자 이상 ${maximumLength}자 이하로 입력해 주세요.`,
    );
  }

  return normalizedValue;
}

function validateMemberCount(memberCount) {
  if (
    !Number.isSafeInteger(memberCount) ||
    memberCount < 1 ||
    memberCount > MAX_GROUP_MEMBER_COUNT
  ) {
    throw new ApplicationError(
      `참여 인원은 1명 이상 ${MAX_GROUP_MEMBER_COUNT}명 이하로 설정해 주세요.`,
    );
  }

  return memberCount;
}

function createInviteDocuments(groupId, inviteCount, createdAt) {
  const expiresAt = createInviteExpirationDate(createdAt);
  const inviteDocuments = [];
  const invitePaths = [];

  for (let index = 0; index < inviteCount; index += 1) {
    const rawToken = createSecureToken();

    inviteDocuments.push({
      _id: randomUUID(),
      group_id: groupId,
      member_id: null,
      token_hash: hashSecureToken(rawToken),
      status: "ACTIVE",
      expires_at: new Date(expiresAt.getTime()),
      claimed_at: null,
      created_at: new Date(createdAt.getTime()),
    });
    invitePaths.push(`/invite/${rawToken}`);
  }

  return { inviteDocuments, invitePaths };
}

export async function listOwnedGroups(userId) {
  return db
    .collection("expense_group")
    .find(
      { created_by: String(userId) },
      {
        projection: {
          name: 1,
          mode: 1,
          status: 1,
          expected_member_count: 1,
          updated_at: 1,
        },
      },
    )
    .sort({ updated_at: -1, _id: 1 })
    .toArray();
}

export async function createExpenseGroup({
  userId,
  userName,
  groupName,
  ownerNickname,
  mode,
  soloMemberNicknames,
  togetherMemberCount,
}) {
  const normalizedGroupName = normalizeText(groupName, "모임 이름", 60);
  const normalizedOwnerNickname = normalizeText(
    ownerNickname || userName,
    "내 별명",
    30,
  );
  const groupId = randomUUID();
  const createdAt = new Date();
  let expectedMemberCount;
  let guestMemberNicknames = [];

  if (mode === GROUP_MODE.SOLO) {
    guestMemberNicknames = soloMemberNicknames
      .map((nickname) => nickname.trim())
      .filter(Boolean)
      .map((nickname) => normalizeText(nickname, "참여자 별명", 30));
    expectedMemberCount = validateMemberCount(guestMemberNicknames.length + 1);

    const comparableNicknames = [
      normalizedOwnerNickname,
      ...guestMemberNicknames,
    ].map((nickname) => nickname.toLocaleLowerCase("ko-KR"));

    if (new Set(comparableNicknames).size !== comparableNicknames.length) {
      throw new ApplicationError("참여자 별명은 서로 다르게 입력해 주세요.");
    }
  } else if (mode === GROUP_MODE.TOGETHER) {
    expectedMemberCount = validateMemberCount(togetherMemberCount);

    if (expectedMemberCount < 2) {
      throw new ApplicationError("함께하기는 총 2명 이상이어야 합니다.");
    }
  } else {
    throw new ApplicationError("모임 방식을 다시 선택해 주세요.");
  }

  const initialState = createInitialGroupState({
    mode,
    expectedMemberCount,
    createdAt,
  });
  const ownerMember = {
    _id: randomUUID(),
    group_id: groupId,
    user_id: String(userId),
    nickname: normalizedOwnerNickname,
    member_type: "registered",
  };
  const guestMembers = guestMemberNicknames.map((nickname) => ({
    _id: randomUUID(),
    group_id: groupId,
    user_id: null,
    nickname,
    member_type: "guest",
  }));
  const { inviteDocuments, invitePaths } =
    mode === GROUP_MODE.TOGETHER
      ? createInviteDocuments(groupId, expectedMemberCount - 1, createdAt)
      : { inviteDocuments: [], invitePaths: [] };
  const groupDocument = {
    _id: groupId,
    name: normalizedGroupName,
    created_by: String(userId),
    ...initialState,
    created_at: new Date(createdAt.getTime()),
    updated_at: new Date(createdAt.getTime()),
  };

  await runInTransaction(async (session) => {
    await db.collection("expense_group").insertOne(groupDocument, { session });
    await db
      .collection("group_member")
      .insertMany([ownerMember, ...guestMembers], { session });

    if (inviteDocuments.length > 0) {
      await db.collection("invite").insertMany(inviteDocuments, { session });
    }
  });

  return {
    groupId,
    mode,
    invitePaths,
  };
}

export async function getGroupWorkspaceData(groupId, selectedReceiptId) {
  const [members, receipts, invites] = await Promise.all([
    db
      .collection("group_member")
      .find({ group_id: groupId })
      .sort({ nickname: 1, _id: 1 })
      .toArray(),
    db
      .collection("receipts")
      .find({ group_id: groupId })
      .sort({ _id: 1 })
      .toArray(),
    db
      .collection("invite")
      .find(
        { group_id: groupId },
        {
          projection: {
            member_id: 1,
            status: 1,
            expires_at: 1,
            claimed_at: 1,
          },
        },
      )
      .sort({ created_at: 1, _id: 1 })
      .toArray(),
  ]);
  const selectedReceipt =
    receipts.find((receipt) => receipt._id === selectedReceiptId) ??
    receipts[0] ??
    null;
  const payments = selectedReceipt
    ? await db
        .collection("payment")
        .find({
          group_id: groupId,
          receipt_id: selectedReceipt._id,
        })
        .sort({ expense_item_id: 1, payer_member_id: 1 })
        .toArray()
    : [];

  return {
    members,
    receipts,
    invites,
    selectedReceipt,
    payments,
  };
}

export async function getReceiptEditorData(groupId, receiptId = null) {
  const [members, receipt] = await Promise.all([
    db
      .collection("group_member")
      .find({ group_id: groupId })
      .sort({ nickname: 1, _id: 1 })
      .toArray(),
    receiptId
      ? db.collection("receipts").findOne({
          _id: receiptId,
          group_id: groupId,
        })
      : Promise.resolve(null),
  ]);

  return { members, receipt };
}

export async function regenerateUnusedInvite({ groupId, inviteId }) {
  const rawToken = createSecureToken();
  const now = new Date();
  const result = await db.collection("invite").updateOne(
    {
      _id: inviteId,
      group_id: groupId,
      status: "ACTIVE",
      member_id: null,
    },
    {
      $set: {
        token_hash: hashSecureToken(rawToken),
        expires_at: createInviteExpirationDate(now),
        claimed_at: null,
        created_at: now,
      },
    },
  );

  if (result.modifiedCount !== 1) {
    throw new ApplicationError("재발급할 수 있는 초대가 아닙니다.");
  }

  return `/invite/${rawToken}`;
}
