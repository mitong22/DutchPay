const { MongoClient } = require("mongodb");

// 인자 없이 실행하거나 --preview를 사용하면 DB에 연결하지 않는다.
// 실제 쓰기는 --write와 ALLOW_DATABASE_SEED=true가 모두 있을 때만 허용한다.

const SEED_GROUP_IDS = Object.freeze({
  SOLO_ACTIVE: "10000000-0000-4000-8000-000000000001",
  TOGETHER_WAITING: "20000000-0000-4000-8000-000000000001",
  TOGETHER_ACTIVE: "30000000-0000-4000-8000-000000000001",
});

const SEED_MEMBER_IDS = Object.freeze({
  SOLO_OWNER: "11000000-0000-4000-8000-000000000001",
  SOLO_GUEST_1: "11000000-0000-4000-8000-000000000002",
  SOLO_GUEST_2: "11000000-0000-4000-8000-000000000003",
  SOLO_GUEST_3: "11000000-0000-4000-8000-000000000004",
  WAITING_OWNER: "21000000-0000-4000-8000-000000000001",
  WAITING_GUEST_1: "21000000-0000-4000-8000-000000000002",
  WAITING_GUEST_2: "21000000-0000-4000-8000-000000000003",
  ACTIVE_OWNER: "31000000-0000-4000-8000-000000000001",
  ACTIVE_GUEST_1: "31000000-0000-4000-8000-000000000002",
  ACTIVE_GUEST_2: "31000000-0000-4000-8000-000000000003",
  ACTIVE_GUEST_3: "31000000-0000-4000-8000-000000000004",
});

function createMember({
  id,
  groupId,
  nickname,
  ownerUserId = null,
  createdAt,
}) {
  const isRegisteredOwner = ownerUserId !== null;

  return {
    _id: id,
    group_id: groupId,
    user_id: ownerUserId,
    nickname,
    member_type: isRegisteredOwner ? "registered" : "guest",
    created_at: new Date(createdAt.getTime()),
    joined_at: new Date(createdAt.getTime()),
  };
}

async function buildSeedDocuments(ownerUserId) {
  if (typeof ownerUserId !== "string" || ownerUserId.trim() === "") {
    throw new TypeError("ownerUserId must be a non-empty string.");
  }

  const {
    GROUP_MODE,
    GROUP_STATUS,
    createInitialGroupState,
    createSharedMigrationState,
    validatePersistedGroupState,
  } = await import("../lib/group-rules.mjs");

  const soloCreatedAt = new Date("2026-01-10T09:00:00.000Z");
  const waitingCreatedAt = new Date("2026-01-11T09:00:00.000Z");
  const activeCreatedAt = new Date("2026-01-12T09:00:00.000Z");

  const soloState = createInitialGroupState({
    mode: GROUP_MODE.SOLO,
    expectedMemberCount: 4,
    createdAt: soloCreatedAt,
  });
  const waitingState = createInitialGroupState({
    mode: GROUP_MODE.TOGETHER,
    expectedMemberCount: 4,
    createdAt: waitingCreatedAt,
  });
  const activeState = createSharedMigrationState({
    memberCount: 4,
    createdAt: activeCreatedAt,
  });

  const expenseGroups = [
    {
      _id: SEED_GROUP_IDS.SOLO_ACTIVE,
      name: "[SEED] SOLO 활성 모임",
      created_by: ownerUserId,
      ...soloState,
      created_at: soloCreatedAt,
      updated_at: soloCreatedAt,
    },
    {
      _id: SEED_GROUP_IDS.TOGETHER_WAITING,
      name: "[SEED] TOGETHER 대기 모임",
      created_by: ownerUserId,
      ...waitingState,
      created_at: waitingCreatedAt,
      updated_at: waitingCreatedAt,
    },
    {
      _id: SEED_GROUP_IDS.TOGETHER_ACTIVE,
      name: "[SEED] 기존 shared 전환 모임",
      created_by: ownerUserId,
      ...activeState,
      created_at: activeCreatedAt,
      updated_at: activeCreatedAt,
    },
  ];

  const groupMembers = [
    createMember({
      id: SEED_MEMBER_IDS.SOLO_OWNER,
      groupId: SEED_GROUP_IDS.SOLO_ACTIVE,
      nickname: "SOLO 총대",
      ownerUserId,
      createdAt: soloCreatedAt,
    }),
    createMember({
      id: SEED_MEMBER_IDS.SOLO_GUEST_1,
      groupId: SEED_GROUP_IDS.SOLO_ACTIVE,
      nickname: "SOLO 참여자 1",
      createdAt: soloCreatedAt,
    }),
    createMember({
      id: SEED_MEMBER_IDS.SOLO_GUEST_2,
      groupId: SEED_GROUP_IDS.SOLO_ACTIVE,
      nickname: "SOLO 참여자 2",
      createdAt: soloCreatedAt,
    }),
    createMember({
      id: SEED_MEMBER_IDS.SOLO_GUEST_3,
      groupId: SEED_GROUP_IDS.SOLO_ACTIVE,
      nickname: "SOLO 참여자 3",
      createdAt: soloCreatedAt,
    }),
    createMember({
      id: SEED_MEMBER_IDS.WAITING_OWNER,
      groupId: SEED_GROUP_IDS.TOGETHER_WAITING,
      nickname: "TOGETHER 총대",
      ownerUserId,
      createdAt: waitingCreatedAt,
    }),
    createMember({
      id: SEED_MEMBER_IDS.WAITING_GUEST_1,
      groupId: SEED_GROUP_IDS.TOGETHER_WAITING,
      nickname: "TOGETHER 참여자 1",
      createdAt: waitingCreatedAt,
    }),
    createMember({
      id: SEED_MEMBER_IDS.WAITING_GUEST_2,
      groupId: SEED_GROUP_IDS.TOGETHER_WAITING,
      nickname: "TOGETHER 참여자 2",
      createdAt: waitingCreatedAt,
    }),
    createMember({
      id: SEED_MEMBER_IDS.ACTIVE_OWNER,
      groupId: SEED_GROUP_IDS.TOGETHER_ACTIVE,
      nickname: "전환 모임 총대",
      ownerUserId,
      createdAt: activeCreatedAt,
    }),
    createMember({
      id: SEED_MEMBER_IDS.ACTIVE_GUEST_1,
      groupId: SEED_GROUP_IDS.TOGETHER_ACTIVE,
      nickname: "전환 모임 참여자 1",
      createdAt: activeCreatedAt,
    }),
    createMember({
      id: SEED_MEMBER_IDS.ACTIVE_GUEST_2,
      groupId: SEED_GROUP_IDS.TOGETHER_ACTIVE,
      nickname: "전환 모임 참여자 2",
      createdAt: activeCreatedAt,
    }),
    createMember({
      id: SEED_MEMBER_IDS.ACTIVE_GUEST_3,
      groupId: SEED_GROUP_IDS.TOGETHER_ACTIVE,
      nickname: "전환 모임 참여자 3",
      createdAt: activeCreatedAt,
    }),
  ];

  for (const group of expenseGroups) {
    const joinedMemberCount = groupMembers.filter(
      (member) => member.group_id === group._id,
    ).length;

    validatePersistedGroupState({
      mode: group.mode,
      status: group.status,
      expectedMemberCount: group.expected_member_count,
      joinedMemberCount,
      activatedAt: group.activated_at,
    });

    const ownerMembers = groupMembers.filter(
      (member) =>
        member.group_id === group._id &&
        member.member_type === "registered" &&
        member.user_id === ownerUserId,
    );

    if (ownerMembers.length !== 1) {
      throw new Error(`Seed group ${group._id} must have exactly one registered owner.`);
    }
  }

  const hasLegacySharedMode = expenseGroups.some(
    (group) => group.mode === "shared",
  );

  if (hasLegacySharedMode) {
    throw new Error('Seed documents must not contain mode: "shared".');
  }

  return { expenseGroups, groupMembers };
}

function createSeedPreview(seedDocuments) {
  return {
    writesToDatabase: false,
    collections: {
      expense_group: seedDocuments.expenseGroups.length,
      group_member: seedDocuments.groupMembers.length,
    },
    groups: seedDocuments.expenseGroups.map((group) => ({
      name: group.name,
      mode: group.mode,
      status: group.status,
      expectedMemberCount: group.expected_member_count,
      joinedMemberCount: seedDocuments.groupMembers.filter(
        (member) => member.group_id === group._id,
      ).length,
      registeredMemberCount: seedDocuments.groupMembers.filter(
        (member) =>
          member.group_id === group._id && member.member_type === "registered",
      ).length,
      guestMemberCount: seedDocuments.groupMembers.filter(
        (member) => member.group_id === group._id && member.member_type === "guest",
      ).length,
    })),
  };
}

async function writeSeedDocuments() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed writes are not allowed when NODE_ENV is production.");
  }

  if (process.env.ALLOW_DATABASE_SEED !== "true") {
    throw new Error('Set ALLOW_DATABASE_SEED="true" to allow a seed write.');
  }

  const uri = process.env.MONGODB_URI;
  const databaseName = process.env.MONGODB_DB;
  const ownerEmail = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase();

  if (!uri || !databaseName || !ownerEmail) {
    throw new Error(
      "MONGODB_URI, MONGODB_DB, and SEED_OWNER_EMAIL are required for --write.",
    );
  }

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db(databaseName);
    const ownerUsers = await db
      .collection("user")
      .find({ email: ownerEmail }, { projection: { _id: 1 } })
      .limit(2)
      .toArray();

    if (ownerUsers.length !== 1) {
      throw new Error("SEED_OWNER_EMAIL must identify exactly one Better Auth user.");
    }

    const seedDocuments = await buildSeedDocuments(ownerUsers[0]._id.toString());

    const groupResult = await db.collection("expense_group").bulkWrite(
      seedDocuments.expenseGroups.map((group) => ({
        replaceOne: {
          filter: { _id: group._id },
          replacement: group,
          upsert: true,
        },
      })),
    );

    const memberResult = await db.collection("group_member").bulkWrite(
      seedDocuments.groupMembers.map((member) => ({
        replaceOne: {
          filter: { _id: member._id },
          replacement: member,
          upsert: true,
        },
      })),
    );

    console.log(
      JSON.stringify(
        {
          databaseName,
          betterAuthUsersModified: 0,
          expenseGroupsMatched: groupResult.matchedCount,
          expenseGroupsUpserted: groupResult.upsertedCount,
          groupMembersMatched: memberResult.matchedCount,
          groupMembersUpserted: memberResult.upsertedCount,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.close();
  }
}

async function main() {
  const command = process.argv[2] || "--preview";

  if (command === "--preview") {
    const seedDocuments = await buildSeedDocuments("preview-better-auth-user-id");
    console.log(JSON.stringify(createSeedPreview(seedDocuments), null, 2));
    return;
  }

  if (command === "--write") {
    await writeSeedDocuments();
    return;
  }

  throw new Error('Use either "--preview" or "--write".');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  SEED_GROUP_IDS,
  SEED_MEMBER_IDS,
  buildSeedDocuments,
  createSeedPreview,
};
