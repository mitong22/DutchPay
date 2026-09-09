const { MongoClient } = require("mongodb");

const {
  validateSeedDocuments,
} = require("./seed-data-validation.js");

// Atlas 원본의 관계와 금액은 유지하되 원본 ID와 이름은 저장하지 않는다.
// 인자 없이 실행하거나 --preview를 사용하면 DB에 연결하지 않는다.
// 실제 쓰기는 --write와 ALLOW_DATABASE_SEED=true가 모두 있을 때만 허용한다.

const SEED_GROUP_IDS = Object.freeze({
  TOGETHER_WAITING: "20000000-0000-4000-8000-000000000001",
  TOGETHER_ACTIVE_FROM_SHARED: "30000000-0000-4000-8000-000000000001",
});

const SEED_MEMBER_IDS = Object.freeze({
  WAITING_OWNER: "21000000-0000-4000-8000-000000000001",
  ACTIVE_OWNER: "31000000-0000-4000-8000-000000000001",
  ACTIVE_GUEST_1: "31000000-0000-4000-8000-000000000002",
  ACTIVE_GUEST_2: "31000000-0000-4000-8000-000000000003",
  ACTIVE_GUEST_3: "31000000-0000-4000-8000-000000000004",
});

const SEED_RECEIPT_IDS = Object.freeze({
  ACTIVE_MEAL: "32000000-0000-4000-8000-000000000001",
});

const SEED_ITEM_IDS = Object.freeze({
  ACTIVE_MENU_1: "32100000-0000-4000-8000-000000000001",
  ACTIVE_MENU_2: "32100000-0000-4000-8000-000000000002",
});

const SEED_PAYMENT_IDS = Object.freeze({
  MENU_1_OWNER: "33000000-0000-4000-8000-000000000001",
  MENU_1_GUEST_3: "33000000-0000-4000-8000-000000000002",
  MENU_1_GUEST_2: "33000000-0000-4000-8000-000000000003",
  MENU_2_OWNER: "33000000-0000-4000-8000-000000000004",
  MENU_2_GUEST_3: "33000000-0000-4000-8000-000000000005",
});

const ATLAS_SNAPSHOT_TIMESTAMPS = Object.freeze({
  TOGETHER_WAITING_CREATED_AT: "2026-09-08T08:14:53.732Z",
  SHARED_CREATED_AT: "2026-09-07T07:56:11.746Z",
  PAYMENT_CREATED_AT: "2026-09-08T03:06:43.019Z",
  NORMALIZED_AT: "2026-09-09T00:00:00.000Z",
});

function createMember({ id, groupId, nickname, ownerUserId = null }) {
  const isRegisteredOwner = ownerUserId !== null;

  return {
    _id: id,
    group_id: groupId,
    user_id: ownerUserId,
    nickname,
    member_type: isRegisteredOwner ? "registered" : "guest",
  };
}

function createPayment({ id, itemId, payerMemberId, status, createdAt }) {
  return {
    _id: id,
    group_id: SEED_GROUP_IDS.TOGETHER_ACTIVE_FROM_SHARED,
    receipt_id: SEED_RECEIPT_IDS.ACTIVE_MEAL,
    expense_item_id: itemId,
    payer_member_id: payerMemberId,
    payee_member_id: SEED_MEMBER_IDS.ACTIVE_OWNER,
    status,
    created_at: new Date(createdAt.getTime()),
  };
}

async function buildSeedDocuments(ownerUserId) {
  if (typeof ownerUserId !== "string" || ownerUserId.trim() === "") {
    throw new TypeError("ownerUserId must be a non-empty string.");
  }

  const {
    GROUP_MODE,
    createInitialGroupState,
    createSharedMigrationState,
    validatePersistedGroupState,
  } = await import("../lib/group-rules.mjs");

  const waitingCreatedAt = new Date(
    ATLAS_SNAPSHOT_TIMESTAMPS.TOGETHER_WAITING_CREATED_AT,
  );
  const sharedCreatedAt = new Date(
    ATLAS_SNAPSHOT_TIMESTAMPS.SHARED_CREATED_AT,
  );
  const paymentCreatedAt = new Date(
    ATLAS_SNAPSHOT_TIMESTAMPS.PAYMENT_CREATED_AT,
  );
  const normalizedAt = new Date(ATLAS_SNAPSHOT_TIMESTAMPS.NORMALIZED_AT);
  const waitingState = createInitialGroupState({
    mode: GROUP_MODE.TOGETHER,
    expectedMemberCount: 4,
    createdAt: waitingCreatedAt,
  });
  const migratedSharedState = createSharedMigrationState({
    memberCount: 4,
    createdAt: sharedCreatedAt,
  });

  const expenseGroups = [
    {
      _id: SEED_GROUP_IDS.TOGETHER_WAITING,
      name: "[SEED] Atlas 기반 TOGETHER 대기 모임",
      created_by: ownerUserId,
      ...waitingState,
      created_at: waitingCreatedAt,
      updated_at: new Date(normalizedAt.getTime()),
    },
    {
      _id: SEED_GROUP_IDS.TOGETHER_ACTIVE_FROM_SHARED,
      name: "[SEED] Atlas shared 전환 모임",
      created_by: ownerUserId,
      ...migratedSharedState,
      created_at: sharedCreatedAt,
      updated_at: new Date(normalizedAt.getTime()),
    },
  ];

  const groupMembers = [
    createMember({
      id: SEED_MEMBER_IDS.WAITING_OWNER,
      groupId: SEED_GROUP_IDS.TOGETHER_WAITING,
      nickname: "대기 모임 총대",
      ownerUserId,
    }),
    createMember({
      id: SEED_MEMBER_IDS.ACTIVE_OWNER,
      groupId: SEED_GROUP_IDS.TOGETHER_ACTIVE_FROM_SHARED,
      nickname: "전환 모임 총대",
      ownerUserId,
    }),
    createMember({
      id: SEED_MEMBER_IDS.ACTIVE_GUEST_1,
      groupId: SEED_GROUP_IDS.TOGETHER_ACTIVE_FROM_SHARED,
      nickname: "전환 모임 참여자 1",
    }),
    createMember({
      id: SEED_MEMBER_IDS.ACTIVE_GUEST_2,
      groupId: SEED_GROUP_IDS.TOGETHER_ACTIVE_FROM_SHARED,
      nickname: "전환 모임 참여자 2",
    }),
    createMember({
      id: SEED_MEMBER_IDS.ACTIVE_GUEST_3,
      groupId: SEED_GROUP_IDS.TOGETHER_ACTIVE_FROM_SHARED,
      nickname: "전환 모임 참여자 3",
    }),
  ];

  const receipts = [
    {
      _id: SEED_RECEIPT_IDS.ACTIVE_MEAL,
      group_id: SEED_GROUP_IDS.TOGETHER_ACTIVE_FROM_SHARED,
      store_name: "[SEED] Atlas 기반 식당",
      total_amount: 36000,
      paid_by_member_id: SEED_MEMBER_IDS.ACTIVE_OWNER,
      uploaded_by_member_id: SEED_MEMBER_IDS.ACTIVE_OWNER,
      items: [
        {
          _id: SEED_ITEM_IDS.ACTIVE_MENU_1,
          menu_name: "메뉴 1",
          quantity: 2,
          unit_price: 15000,
          line_total: 30000,
          consumer_member_ids: [
            SEED_MEMBER_IDS.ACTIVE_OWNER,
            SEED_MEMBER_IDS.ACTIVE_GUEST_3,
            SEED_MEMBER_IDS.ACTIVE_GUEST_2,
          ],
        },
        {
          _id: SEED_ITEM_IDS.ACTIVE_MENU_2,
          menu_name: "메뉴 2",
          quantity: 2,
          unit_price: 3000,
          line_total: 6000,
          consumer_member_ids: [
            SEED_MEMBER_IDS.ACTIVE_OWNER,
            SEED_MEMBER_IDS.ACTIVE_GUEST_3,
          ],
        },
      ],
    },
  ];

  const payments = [
    createPayment({
      id: SEED_PAYMENT_IDS.MENU_1_OWNER,
      itemId: SEED_ITEM_IDS.ACTIVE_MENU_1,
      payerMemberId: SEED_MEMBER_IDS.ACTIVE_OWNER,
      status: "paid",
      createdAt: paymentCreatedAt,
    }),
    createPayment({
      id: SEED_PAYMENT_IDS.MENU_1_GUEST_3,
      itemId: SEED_ITEM_IDS.ACTIVE_MENU_1,
      payerMemberId: SEED_MEMBER_IDS.ACTIVE_GUEST_3,
      status: "unpaid",
      createdAt: paymentCreatedAt,
    }),
    createPayment({
      id: SEED_PAYMENT_IDS.MENU_1_GUEST_2,
      itemId: SEED_ITEM_IDS.ACTIVE_MENU_1,
      payerMemberId: SEED_MEMBER_IDS.ACTIVE_GUEST_2,
      status: "unpaid",
      createdAt: paymentCreatedAt,
    }),
    createPayment({
      id: SEED_PAYMENT_IDS.MENU_2_OWNER,
      itemId: SEED_ITEM_IDS.ACTIVE_MENU_2,
      payerMemberId: SEED_MEMBER_IDS.ACTIVE_OWNER,
      status: "paid",
      createdAt: paymentCreatedAt,
    }),
    createPayment({
      id: SEED_PAYMENT_IDS.MENU_2_GUEST_3,
      itemId: SEED_ITEM_IDS.ACTIVE_MENU_2,
      payerMemberId: SEED_MEMBER_IDS.ACTIVE_GUEST_3,
      status: "unpaid",
      createdAt: paymentCreatedAt,
    }),
  ];
  const seedDocuments = {
    expenseGroups,
    groupMembers,
    receipts,
    payments,
  };

  validateSeedDocuments(seedDocuments, validatePersistedGroupState);

  return seedDocuments;
}

function createSeedPreview(seedDocuments) {
  return {
    source: "anonymized Atlas snapshot normalized to the current schema",
    writesToDatabase: false,
    collections: {
      expense_group: seedDocuments.expenseGroups.length,
      group_member: seedDocuments.groupMembers.length,
      receipts: seedDocuments.receipts.length,
      payment: seedDocuments.payments.length,
    },
    groups: seedDocuments.expenseGroups.map((group) => {
      const groupMembers = seedDocuments.groupMembers.filter(
        (member) => member.group_id === group._id,
      );
      const groupReceipts = seedDocuments.receipts.filter(
        (receipt) => receipt.group_id === group._id,
      );
      const groupPayments = seedDocuments.payments.filter(
        (payment) => payment.group_id === group._id,
      );

      return {
        name: group.name,
        mode: group.mode,
        status: group.status,
        expectedMemberCount: group.expected_member_count,
        joinedMemberCount: groupMembers.length,
        registeredMemberCount: groupMembers.filter(
          (member) => member.member_type === "registered",
        ).length,
        guestMemberCount: groupMembers.filter(
          (member) => member.member_type === "guest",
        ).length,
        receiptCount: groupReceipts.length,
        itemCount: groupReceipts.reduce(
          (count, receipt) => count + receipt.items.length,
          0,
        ),
        paymentCount: groupPayments.length,
      };
    }),
  };
}

function createReplaceOperations(documents) {
  return documents.map((document) => ({
    replaceOne: {
      filter: { _id: document._id },
      replacement: document,
      upsert: true,
    },
  }));
}

async function writeCollection(db, collectionName, documents) {
  return db
    .collection(collectionName)
    .bulkWrite(createReplaceOperations(documents));
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

  const client = new MongoClient(uri, {
    appName: "DutchPayAtlasBasedSeed",
  });
  await client.connect();

  try {
    const db = client.db(databaseName);
    const ownerUsers = await db
      .collection("user")
      .find({ email: ownerEmail }, { projection: { _id: 1 } })
      .limit(2)
      .toArray();

    if (ownerUsers.length !== 1) {
      throw new Error(
        "SEED_OWNER_EMAIL must identify exactly one Better Auth user.",
      );
    }

    const seedDocuments = await buildSeedDocuments(
      ownerUsers[0]._id.toString(),
    );
    const groupResult = await writeCollection(
      db,
      "expense_group",
      seedDocuments.expenseGroups,
    );
    const memberResult = await writeCollection(
      db,
      "group_member",
      seedDocuments.groupMembers,
    );
    const receiptResult = await writeCollection(
      db,
      "receipts",
      seedDocuments.receipts,
    );
    const paymentResult = await writeCollection(
      db,
      "payment",
      seedDocuments.payments,
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
          receiptsMatched: receiptResult.matchedCount,
          receiptsUpserted: receiptResult.upsertedCount,
          paymentsMatched: paymentResult.matchedCount,
          paymentsUpserted: paymentResult.upsertedCount,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.close();
  }
}

function parseSeedCommand(argumentsList) {
  if (argumentsList.length === 0) {
    return "--preview";
  }

  if (
    argumentsList.length === 1 &&
    (argumentsList[0] === "--preview" || argumentsList[0] === "--write")
  ) {
    return argumentsList[0];
  }

  throw new Error('Use either no argument, "--preview", or "--write".');
}

async function main() {
  const command = parseSeedCommand(process.argv.slice(2));

  if (command === "--preview") {
    const seedDocuments = await buildSeedDocuments(
      "preview-better-auth-user-id",
    );
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
  SEED_ITEM_IDS,
  SEED_MEMBER_IDS,
  SEED_PAYMENT_IDS,
  SEED_RECEIPT_IDS,
  buildSeedDocuments,
  createSeedPreview,
  parseSeedCommand,
};
