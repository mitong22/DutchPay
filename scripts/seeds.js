const { createHash } = require("node:crypto");
const { MongoClient } = require("mongodb");

const {
  validateSeedDocuments,
} = require("./seed-data-validation.js");

// Atlas 원본의 관계와 금액은 유지하되 원본 ID와 이름은 저장하지 않는다.
// 기능 검증용 데이터는 Atlas 기반 데이터와 구분되는 합성 Seed로 추가한다.
// 인자 없이 실행하거나 --preview를 사용하면 DB에 연결하지 않는다.
// 실제 쓰기는 --write와 명시적인 개발 DB 확인 값이 모두 있을 때만 허용한다.

const SEED_NAMESPACE = "dutchpay-development";
const SEED_VERSION = 2;

const SEED_GROUP_IDS = Object.freeze({
  SOLO_ACTIVE: "10000000-0000-4000-8000-000000000001",
  TOGETHER_WAITING: "20000000-0000-4000-8000-000000000001",
  TOGETHER_ACTIVE_FROM_SHARED: "30000000-0000-4000-8000-000000000001",
  TOGETHER_ACTIVE_MULTI_PAYER: "40000000-0000-4000-8000-000000000001",
});

const SEED_MEMBER_IDS = Object.freeze({
  SOLO_OWNER: "11000000-0000-4000-8000-000000000001",
  SOLO_GUEST_1: "11000000-0000-4000-8000-000000000002",
  SOLO_GUEST_2: "11000000-0000-4000-8000-000000000003",
  SOLO_GUEST_3: "11000000-0000-4000-8000-000000000004",
  WAITING_OWNER: "21000000-0000-4000-8000-000000000001",
  ACTIVE_OWNER: "31000000-0000-4000-8000-000000000001",
  ACTIVE_GUEST_1: "31000000-0000-4000-8000-000000000002",
  ACTIVE_GUEST_2: "31000000-0000-4000-8000-000000000003",
  ACTIVE_GUEST_3: "31000000-0000-4000-8000-000000000004",
  MULTI_OWNER: "41000000-0000-4000-8000-000000000001",
  MULTI_GUEST_1: "41000000-0000-4000-8000-000000000002",
  MULTI_GUEST_2: "41000000-0000-4000-8000-000000000003",
  MULTI_GUEST_3: "41000000-0000-4000-8000-000000000004",
});

const SEED_RECEIPT_IDS = Object.freeze({
  SOLO_MEAL: "12000000-0000-4000-8000-000000000001",
  SOLO_CAFE: "12000000-0000-4000-8000-000000000002",
  ACTIVE_MEAL: "32000000-0000-4000-8000-000000000001",
  MULTI_DINNER: "42000000-0000-4000-8000-000000000001",
  MULTI_CAFE: "42000000-0000-4000-8000-000000000002",
  MULTI_TAXI: "42000000-0000-4000-8000-000000000003",
});

const SEED_ITEM_IDS = Object.freeze({
  SOLO_MENU_WITH_REMAINDER: "12100000-0000-4000-8000-000000000001",
  SOLO_SHARED_MENU: "12100000-0000-4000-8000-000000000002",
  SOLO_CAFE_MENU: "12100000-0000-4000-8000-000000000003",
  ACTIVE_MENU_1: "32100000-0000-4000-8000-000000000001",
  ACTIVE_MENU_2: "32100000-0000-4000-8000-000000000002",
  MULTI_DINNER_MENU: "42100000-0000-4000-8000-000000000001",
  MULTI_CAFE_MAIN: "42100000-0000-4000-8000-000000000002",
  MULTI_CAFE_DESSERT: "42100000-0000-4000-8000-000000000003",
  MULTI_TAXI_WITH_REMAINDER: "42100000-0000-4000-8000-000000000004",
});

const SEED_PAYMENT_IDS = Object.freeze({
  SOLO_REMAINDER_OWNER: "13000000-0000-4000-8000-000000000001",
  SOLO_REMAINDER_GUEST_1: "13000000-0000-4000-8000-000000000002",
  SOLO_REMAINDER_GUEST_2: "13000000-0000-4000-8000-000000000003",
  SOLO_SHARED_OWNER: "13000000-0000-4000-8000-000000000004",
  SOLO_SHARED_GUEST_1: "13000000-0000-4000-8000-000000000005",
  SOLO_SHARED_GUEST_2: "13000000-0000-4000-8000-000000000006",
  SOLO_CAFE_OWNER: "13000000-0000-4000-8000-000000000008",
  SOLO_CAFE_GUEST_3: "13000000-0000-4000-8000-000000000009",
  MENU_1_OWNER: "33000000-0000-4000-8000-000000000001",
  MENU_1_GUEST_3: "33000000-0000-4000-8000-000000000002",
  MENU_1_GUEST_2: "33000000-0000-4000-8000-000000000003",
  MENU_2_OWNER: "33000000-0000-4000-8000-000000000004",
  MENU_2_GUEST_3: "33000000-0000-4000-8000-000000000005",
  MULTI_DINNER_OWNER: "43000000-0000-4000-8000-000000000001",
  MULTI_DINNER_GUEST_1: "43000000-0000-4000-8000-000000000002",
  MULTI_DINNER_GUEST_2: "43000000-0000-4000-8000-000000000003",
  MULTI_CAFE_MAIN_GUEST_1: "43000000-0000-4000-8000-000000000004",
  MULTI_CAFE_MAIN_GUEST_2: "43000000-0000-4000-8000-000000000005",
  MULTI_CAFE_MAIN_GUEST_3: "43000000-0000-4000-8000-000000000006",
  MULTI_CAFE_DESSERT_GUEST_1: "43000000-0000-4000-8000-000000000007",
  MULTI_CAFE_DESSERT_GUEST_3: "43000000-0000-4000-8000-000000000008",
  MULTI_TAXI_OWNER: "43000000-0000-4000-8000-000000000009",
  MULTI_TAXI_GUEST_2: "43000000-0000-4000-8000-000000000010",
  MULTI_TAXI_GUEST_3: "43000000-0000-4000-8000-000000000011",
});

const SEED_INVITE_IDS = Object.freeze({
  WAITING_SLOT_1: "22000000-0000-4000-8000-000000000001",
  WAITING_SLOT_2: "22000000-0000-4000-8000-000000000002",
  WAITING_SLOT_3: "22000000-0000-4000-8000-000000000003",
  MULTI_GUEST_1: "44000000-0000-4000-8000-000000000001",
  MULTI_GUEST_2: "44000000-0000-4000-8000-000000000002",
  MULTI_GUEST_3: "44000000-0000-4000-8000-000000000003",
});

const SEED_GUEST_SESSION_IDS = Object.freeze({
  MULTI_GUEST_1: "45000000-0000-4000-8000-000000000001",
  MULTI_GUEST_2: "45000000-0000-4000-8000-000000000002",
  MULTI_GUEST_3: "45000000-0000-4000-8000-000000000003",
});

const SEED_TIMESTAMPS = Object.freeze({
  TOGETHER_WAITING_CREATED_AT: "2026-09-08T08:14:53.732Z",
  SHARED_CREATED_AT: "2026-09-07T07:56:11.746Z",
  ATLAS_PAYMENT_CREATED_AT: "2026-09-08T03:06:43.019Z",
  NORMALIZED_AT: "2026-09-09T00:00:00.000Z",
  SOLO_CREATED_AT: "2026-09-09T00:30:00.000Z",
  SOLO_PAYMENT_CREATED_AT: "2026-09-09T00:40:00.000Z",
  MULTI_CREATED_AT: "2026-09-09T01:00:00.000Z",
  MULTI_GUEST_1_CLAIMED_AT: "2026-09-09T01:05:00.000Z",
  MULTI_GUEST_2_CLAIMED_AT: "2026-09-09T01:06:00.000Z",
  MULTI_GUEST_3_CLAIMED_AT: "2026-09-09T01:07:00.000Z",
  MULTI_ACTIVATED_AT: "2026-09-09T01:08:00.000Z",
  MULTI_PAYMENT_CREATED_AT: "2026-09-09T01:20:00.000Z",
  WAITING_INVITE_EXPIRES_AT: "2099-10-08T08:14:53.732Z",
  MULTI_INVITE_EXPIRES_AT: "2099-10-09T01:00:00.000Z",
  MULTI_GUEST_SESSION_EXPIRES_AT: "2099-10-09T01:30:00.000Z",
});

function createSeedMetadata() {
  return {
    namespace: SEED_NAMESPACE,
    version: SEED_VERSION,
  };
}

function withSeedMetadata(document) {
  return {
    ...document,
    seed_metadata: createSeedMetadata(),
  };
}

function createSeedTokenHash(label) {
  return createHash("sha256")
    .update(`dutchpay-development-seed:${label}`)
    .digest("hex");
}

function createMember({ id, groupId, nickname, ownerUserId = null }) {
  const isRegisteredOwner = ownerUserId !== null;

  return withSeedMetadata({
    _id: id,
    group_id: groupId,
    user_id: ownerUserId,
    nickname,
    member_type: isRegisteredOwner ? "registered" : "guest",
  });
}

function createPayment({
  id,
  groupId,
  receiptId,
  itemId,
  payerMemberId,
  payeeMemberId,
  createdAt,
}) {
  return withSeedMetadata({
    _id: id,
    group_id: groupId,
    receipt_id: receiptId,
    expense_item_id: itemId,
    payer_member_id: payerMemberId,
    payee_member_id: payeeMemberId,
    status: payerMemberId === payeeMemberId ? "paid" : "unpaid",
    created_at: new Date(createdAt.getTime()),
  });
}

function createPaymentsForReceipt({ ids, receipt, createdAt }) {
  const consumerRows = receipt.items.flatMap((item) =>
    item.consumer_member_ids.map((payerMemberId) => ({
      itemId: item._id,
      payerMemberId,
    })),
  );

  if (ids.length !== consumerRows.length) {
    throw new Error("Every generated payment needs one explicit Seed ID.");
  }

  return consumerRows.map((consumerRow, index) =>
    createPayment({
      id: ids[index],
      groupId: receipt.group_id,
      receiptId: receipt._id,
      itemId: consumerRow.itemId,
      payerMemberId: consumerRow.payerMemberId,
      payeeMemberId: receipt.paid_by_member_id,
      createdAt,
    }),
  );
}

function createInvite({
  id,
  groupId,
  memberId = null,
  tokenLabel,
  status = "ACTIVE",
  createdAt,
  expiresAt,
  claimedAt = null,
}) {
  return withSeedMetadata({
    _id: id,
    group_id: groupId,
    member_id: memberId,
    token_hash: createSeedTokenHash(`invite:${tokenLabel}`),
    status,
    expires_at: new Date(expiresAt.getTime()),
    claimed_at: claimedAt ? new Date(claimedAt.getTime()) : null,
    created_at: new Date(createdAt.getTime()),
  });
}

function createGuestSession({
  id,
  groupId,
  memberId,
  tokenLabel,
  createdAt,
  expiresAt,
}) {
  return withSeedMetadata({
    _id: id,
    group_id: groupId,
    member_id: memberId,
    token_hash: createSeedTokenHash(`guest-session:${tokenLabel}`),
    expires_at: new Date(expiresAt.getTime()),
    created_at: new Date(createdAt.getTime()),
  });
}

async function buildSeedDocuments(ownerUserId) {
  if (typeof ownerUserId !== "string" || ownerUserId.trim() === "") {
    throw new TypeError("ownerUserId must be a non-empty string.");
  }

  const {
    GROUP_MODE,
    createActivatedTogetherState,
    createInitialGroupState,
    createSharedMigrationState,
  } = await import("../lib/group-rules.mjs");

  const waitingCreatedAt = new Date(
    SEED_TIMESTAMPS.TOGETHER_WAITING_CREATED_AT,
  );
  const sharedCreatedAt = new Date(SEED_TIMESTAMPS.SHARED_CREATED_AT);
  const atlasPaymentCreatedAt = new Date(
    SEED_TIMESTAMPS.ATLAS_PAYMENT_CREATED_AT,
  );
  const normalizedAt = new Date(SEED_TIMESTAMPS.NORMALIZED_AT);
  const soloCreatedAt = new Date(SEED_TIMESTAMPS.SOLO_CREATED_AT);
  const soloPaymentCreatedAt = new Date(
    SEED_TIMESTAMPS.SOLO_PAYMENT_CREATED_AT,
  );
  const multiCreatedAt = new Date(SEED_TIMESTAMPS.MULTI_CREATED_AT);
  const multiActivatedAt = new Date(SEED_TIMESTAMPS.MULTI_ACTIVATED_AT);
  const multiPaymentCreatedAt = new Date(
    SEED_TIMESTAMPS.MULTI_PAYMENT_CREATED_AT,
  );
  const waitingInviteExpiresAt = new Date(
    SEED_TIMESTAMPS.WAITING_INVITE_EXPIRES_AT,
  );
  const multiInviteExpiresAt = new Date(
    SEED_TIMESTAMPS.MULTI_INVITE_EXPIRES_AT,
  );
  const multiGuestSessionExpiresAt = new Date(
    SEED_TIMESTAMPS.MULTI_GUEST_SESSION_EXPIRES_AT,
  );
  const waitingState = createInitialGroupState({
    mode: GROUP_MODE.TOGETHER,
    expectedMemberCount: 4,
    createdAt: waitingCreatedAt,
  });
  const migratedSharedState = createSharedMigrationState({
    memberCount: 4,
    createdAt: sharedCreatedAt,
  });
  const soloState = createInitialGroupState({
    mode: GROUP_MODE.SOLO,
    expectedMemberCount: 4,
    createdAt: soloCreatedAt,
  });
  const multiPayerState = createActivatedTogetherState({
    expectedMemberCount: 4,
    joinedMemberCount: 4,
    activatedAt: multiActivatedAt,
  });

  const expenseGroups = [
    withSeedMetadata({
      _id: SEED_GROUP_IDS.TOGETHER_WAITING,
      name: "[SEED] Atlas 기반 TOGETHER 대기 모임",
      created_by: ownerUserId,
      ...waitingState,
      created_at: waitingCreatedAt,
      updated_at: new Date(normalizedAt.getTime()),
    }),
    withSeedMetadata({
      _id: SEED_GROUP_IDS.TOGETHER_ACTIVE_FROM_SHARED,
      name: "[SEED] Atlas shared 전환 모임",
      created_by: ownerUserId,
      ...migratedSharedState,
      created_at: sharedCreatedAt,
      updated_at: new Date(normalizedAt.getTime()),
    }),
    withSeedMetadata({
      _id: SEED_GROUP_IDS.SOLO_ACTIVE,
      name: "[SEED] SOLO 합성 검증 모임",
      created_by: ownerUserId,
      ...soloState,
      created_at: soloCreatedAt,
      updated_at: new Date(soloCreatedAt.getTime()),
    }),
    withSeedMetadata({
      _id: SEED_GROUP_IDS.TOGETHER_ACTIVE_MULTI_PAYER,
      name: "[SEED] TOGETHER 다중 결제자 합성 모임",
      created_by: ownerUserId,
      ...multiPayerState,
      created_at: multiCreatedAt,
      updated_at: new Date(multiActivatedAt.getTime()),
    }),
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
    createMember({
      id: SEED_MEMBER_IDS.SOLO_OWNER,
      groupId: SEED_GROUP_IDS.SOLO_ACTIVE,
      nickname: "SOLO 총대",
      ownerUserId,
    }),
    createMember({
      id: SEED_MEMBER_IDS.SOLO_GUEST_1,
      groupId: SEED_GROUP_IDS.SOLO_ACTIVE,
      nickname: "SOLO 참여자 1",
    }),
    createMember({
      id: SEED_MEMBER_IDS.SOLO_GUEST_2,
      groupId: SEED_GROUP_IDS.SOLO_ACTIVE,
      nickname: "SOLO 참여자 2",
    }),
    createMember({
      id: SEED_MEMBER_IDS.SOLO_GUEST_3,
      groupId: SEED_GROUP_IDS.SOLO_ACTIVE,
      nickname: "SOLO 참여자 3",
    }),
    createMember({
      id: SEED_MEMBER_IDS.MULTI_OWNER,
      groupId: SEED_GROUP_IDS.TOGETHER_ACTIVE_MULTI_PAYER,
      nickname: "다중 결제 모임 총대",
      ownerUserId,
    }),
    createMember({
      id: SEED_MEMBER_IDS.MULTI_GUEST_1,
      groupId: SEED_GROUP_IDS.TOGETHER_ACTIVE_MULTI_PAYER,
      nickname: "다중 결제 참여자 1",
    }),
    createMember({
      id: SEED_MEMBER_IDS.MULTI_GUEST_2,
      groupId: SEED_GROUP_IDS.TOGETHER_ACTIVE_MULTI_PAYER,
      nickname: "다중 결제 참여자 2",
    }),
    createMember({
      id: SEED_MEMBER_IDS.MULTI_GUEST_3,
      groupId: SEED_GROUP_IDS.TOGETHER_ACTIVE_MULTI_PAYER,
      nickname: "다중 결제 참여자 3",
    }),
  ];

  const atlasReceipt = withSeedMetadata({
    _id: SEED_RECEIPT_IDS.ACTIVE_MEAL,
    group_id: SEED_GROUP_IDS.TOGETHER_ACTIVE_FROM_SHARED,
    store_name: "[SEED] Atlas 기반 식당",
    total_amount: 36000,
    paid_by_member_id: SEED_MEMBER_IDS.ACTIVE_OWNER,
    uploaded_by_member_id: SEED_MEMBER_IDS.ACTIVE_OWNER,
    participant_member_ids: [
      SEED_MEMBER_IDS.ACTIVE_OWNER,
      SEED_MEMBER_IDS.ACTIVE_GUEST_3,
      SEED_MEMBER_IDS.ACTIVE_GUEST_2,
    ],
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
        remainder_recipient_member_ids: [],
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
        remainder_recipient_member_ids: [],
      },
    ],
  });
  const soloMealReceipt = withSeedMetadata({
    _id: SEED_RECEIPT_IDS.SOLO_MEAL,
    group_id: SEED_GROUP_IDS.SOLO_ACTIVE,
    store_name: "[SEED] SOLO 식사",
    total_amount: 30000,
    paid_by_member_id: SEED_MEMBER_IDS.SOLO_OWNER,
    uploaded_by_member_id: SEED_MEMBER_IDS.SOLO_OWNER,
    participant_member_ids: [
      SEED_MEMBER_IDS.SOLO_OWNER,
      SEED_MEMBER_IDS.SOLO_GUEST_1,
      SEED_MEMBER_IDS.SOLO_GUEST_2,
      SEED_MEMBER_IDS.SOLO_GUEST_3,
    ],
    items: [
      {
        _id: SEED_ITEM_IDS.SOLO_MENU_WITH_REMAINDER,
        menu_name: "10원 나머지 검증 메뉴",
        quantity: 1,
        unit_price: 10000,
        line_total: 10000,
        consumer_member_ids: [
          SEED_MEMBER_IDS.SOLO_OWNER,
          SEED_MEMBER_IDS.SOLO_GUEST_1,
          SEED_MEMBER_IDS.SOLO_GUEST_2,
        ],
        remainder_recipient_member_ids: [SEED_MEMBER_IDS.SOLO_GUEST_2],
      },
      {
        _id: SEED_ITEM_IDS.SOLO_SHARED_MENU,
        menu_name: "전체 참여 메뉴",
        quantity: 1,
        unit_price: 20000,
        line_total: 20000,
        consumer_member_ids: [
          SEED_MEMBER_IDS.SOLO_OWNER,
          SEED_MEMBER_IDS.SOLO_GUEST_1,
          SEED_MEMBER_IDS.SOLO_GUEST_2,
        ],
        remainder_recipient_member_ids: [
          SEED_MEMBER_IDS.SOLO_OWNER,
          SEED_MEMBER_IDS.SOLO_GUEST_1,
        ],
      },
    ],
  });
  const soloCafeReceipt = withSeedMetadata({
    _id: SEED_RECEIPT_IDS.SOLO_CAFE,
    group_id: SEED_GROUP_IDS.SOLO_ACTIVE,
    store_name: "[SEED] SOLO 카페",
    total_amount: 9000,
    paid_by_member_id: SEED_MEMBER_IDS.SOLO_OWNER,
    uploaded_by_member_id: SEED_MEMBER_IDS.SOLO_OWNER,
    participant_member_ids: [
      SEED_MEMBER_IDS.SOLO_OWNER,
      SEED_MEMBER_IDS.SOLO_GUEST_3,
    ],
    items: [
      {
        _id: SEED_ITEM_IDS.SOLO_CAFE_MENU,
        menu_name: "카페 메뉴",
        quantity: 1,
        unit_price: 9000,
        line_total: 9000,
        consumer_member_ids: [
          SEED_MEMBER_IDS.SOLO_OWNER,
          SEED_MEMBER_IDS.SOLO_GUEST_3,
        ],
        remainder_recipient_member_ids: [],
      },
    ],
  });
  const multiDinnerReceipt = withSeedMetadata({
    _id: SEED_RECEIPT_IDS.MULTI_DINNER,
    group_id: SEED_GROUP_IDS.TOGETHER_ACTIVE_MULTI_PAYER,
    store_name: "[SEED] 다중 결제 저녁",
    total_amount: 24000,
    paid_by_member_id: SEED_MEMBER_IDS.MULTI_OWNER,
    uploaded_by_member_id: SEED_MEMBER_IDS.MULTI_GUEST_1,
    participant_member_ids: [
      SEED_MEMBER_IDS.MULTI_OWNER,
      SEED_MEMBER_IDS.MULTI_GUEST_1,
      SEED_MEMBER_IDS.MULTI_GUEST_2,
    ],
    items: [
      {
        _id: SEED_ITEM_IDS.MULTI_DINNER_MENU,
        menu_name: "저녁 메뉴",
        quantity: 1,
        unit_price: 24000,
        line_total: 24000,
        consumer_member_ids: [
          SEED_MEMBER_IDS.MULTI_OWNER,
          SEED_MEMBER_IDS.MULTI_GUEST_1,
          SEED_MEMBER_IDS.MULTI_GUEST_2,
        ],
        remainder_recipient_member_ids: [],
      },
    ],
  });
  const multiCafeReceipt = withSeedMetadata({
    _id: SEED_RECEIPT_IDS.MULTI_CAFE,
    group_id: SEED_GROUP_IDS.TOGETHER_ACTIVE_MULTI_PAYER,
    store_name: "[SEED] 다중 결제 카페",
    total_amount: 30000,
    paid_by_member_id: SEED_MEMBER_IDS.MULTI_GUEST_1,
    uploaded_by_member_id: SEED_MEMBER_IDS.MULTI_GUEST_1,
    participant_member_ids: [
      SEED_MEMBER_IDS.MULTI_GUEST_1,
      SEED_MEMBER_IDS.MULTI_GUEST_2,
      SEED_MEMBER_IDS.MULTI_GUEST_3,
    ],
    items: [
      {
        _id: SEED_ITEM_IDS.MULTI_CAFE_MAIN,
        menu_name: "카페 메인 메뉴",
        quantity: 1,
        unit_price: 24000,
        line_total: 24000,
        consumer_member_ids: [
          SEED_MEMBER_IDS.MULTI_GUEST_1,
          SEED_MEMBER_IDS.MULTI_GUEST_2,
          SEED_MEMBER_IDS.MULTI_GUEST_3,
        ],
        remainder_recipient_member_ids: [],
      },
      {
        _id: SEED_ITEM_IDS.MULTI_CAFE_DESSERT,
        menu_name: "카페 디저트",
        quantity: 1,
        unit_price: 6000,
        line_total: 6000,
        consumer_member_ids: [
          SEED_MEMBER_IDS.MULTI_GUEST_1,
          SEED_MEMBER_IDS.MULTI_GUEST_3,
        ],
        remainder_recipient_member_ids: [],
      },
    ],
  });
  const multiTaxiReceipt = withSeedMetadata({
    _id: SEED_RECEIPT_IDS.MULTI_TAXI,
    group_id: SEED_GROUP_IDS.TOGETHER_ACTIVE_MULTI_PAYER,
    store_name: "[SEED] 다중 결제 택시",
    total_amount: 10000,
    paid_by_member_id: SEED_MEMBER_IDS.MULTI_GUEST_2,
    uploaded_by_member_id: SEED_MEMBER_IDS.MULTI_GUEST_3,
    participant_member_ids: [
      SEED_MEMBER_IDS.MULTI_OWNER,
      SEED_MEMBER_IDS.MULTI_GUEST_2,
      SEED_MEMBER_IDS.MULTI_GUEST_3,
    ],
    items: [
      {
        _id: SEED_ITEM_IDS.MULTI_TAXI_WITH_REMAINDER,
        menu_name: "10원 나머지 검증 택시",
        quantity: 1,
        unit_price: 10000,
        line_total: 10000,
        consumer_member_ids: [
          SEED_MEMBER_IDS.MULTI_OWNER,
          SEED_MEMBER_IDS.MULTI_GUEST_2,
          SEED_MEMBER_IDS.MULTI_GUEST_3,
        ],
        remainder_recipient_member_ids: [SEED_MEMBER_IDS.MULTI_GUEST_3],
      },
    ],
  });
  const receipts = [
    atlasReceipt,
    soloMealReceipt,
    soloCafeReceipt,
    multiDinnerReceipt,
    multiCafeReceipt,
    multiTaxiReceipt,
  ];

  const payments = [
    ...createPaymentsForReceipt({
      ids: [
        SEED_PAYMENT_IDS.MENU_1_OWNER,
        SEED_PAYMENT_IDS.MENU_1_GUEST_3,
        SEED_PAYMENT_IDS.MENU_1_GUEST_2,
        SEED_PAYMENT_IDS.MENU_2_OWNER,
        SEED_PAYMENT_IDS.MENU_2_GUEST_3,
      ],
      receipt: atlasReceipt,
      createdAt: atlasPaymentCreatedAt,
    }),
    ...createPaymentsForReceipt({
      ids: [
        SEED_PAYMENT_IDS.SOLO_REMAINDER_OWNER,
        SEED_PAYMENT_IDS.SOLO_REMAINDER_GUEST_1,
        SEED_PAYMENT_IDS.SOLO_REMAINDER_GUEST_2,
        SEED_PAYMENT_IDS.SOLO_SHARED_OWNER,
        SEED_PAYMENT_IDS.SOLO_SHARED_GUEST_1,
        SEED_PAYMENT_IDS.SOLO_SHARED_GUEST_2,
      ],
      receipt: soloMealReceipt,
      createdAt: soloPaymentCreatedAt,
    }),
    ...createPaymentsForReceipt({
      ids: [
        SEED_PAYMENT_IDS.SOLO_CAFE_OWNER,
        SEED_PAYMENT_IDS.SOLO_CAFE_GUEST_3,
      ],
      receipt: soloCafeReceipt,
      createdAt: soloPaymentCreatedAt,
    }),
    ...createPaymentsForReceipt({
      ids: [
        SEED_PAYMENT_IDS.MULTI_DINNER_OWNER,
        SEED_PAYMENT_IDS.MULTI_DINNER_GUEST_1,
        SEED_PAYMENT_IDS.MULTI_DINNER_GUEST_2,
      ],
      receipt: multiDinnerReceipt,
      createdAt: multiPaymentCreatedAt,
    }),
    ...createPaymentsForReceipt({
      ids: [
        SEED_PAYMENT_IDS.MULTI_CAFE_MAIN_GUEST_1,
        SEED_PAYMENT_IDS.MULTI_CAFE_MAIN_GUEST_2,
        SEED_PAYMENT_IDS.MULTI_CAFE_MAIN_GUEST_3,
        SEED_PAYMENT_IDS.MULTI_CAFE_DESSERT_GUEST_1,
        SEED_PAYMENT_IDS.MULTI_CAFE_DESSERT_GUEST_3,
      ],
      receipt: multiCafeReceipt,
      createdAt: multiPaymentCreatedAt,
    }),
    ...createPaymentsForReceipt({
      ids: [
        SEED_PAYMENT_IDS.MULTI_TAXI_OWNER,
        SEED_PAYMENT_IDS.MULTI_TAXI_GUEST_2,
        SEED_PAYMENT_IDS.MULTI_TAXI_GUEST_3,
      ],
      receipt: multiTaxiReceipt,
      createdAt: multiPaymentCreatedAt,
    }),
  ];

  const multiGuest1ClaimedAt = new Date(
    SEED_TIMESTAMPS.MULTI_GUEST_1_CLAIMED_AT,
  );
  const multiGuest2ClaimedAt = new Date(
    SEED_TIMESTAMPS.MULTI_GUEST_2_CLAIMED_AT,
  );
  const multiGuest3ClaimedAt = new Date(
    SEED_TIMESTAMPS.MULTI_GUEST_3_CLAIMED_AT,
  );
  const invites = [
    createInvite({
      id: SEED_INVITE_IDS.WAITING_SLOT_1,
      groupId: SEED_GROUP_IDS.TOGETHER_WAITING,
      tokenLabel: "waiting-slot-1",
      createdAt: waitingCreatedAt,
      expiresAt: waitingInviteExpiresAt,
    }),
    createInvite({
      id: SEED_INVITE_IDS.WAITING_SLOT_2,
      groupId: SEED_GROUP_IDS.TOGETHER_WAITING,
      tokenLabel: "waiting-slot-2",
      createdAt: waitingCreatedAt,
      expiresAt: waitingInviteExpiresAt,
    }),
    createInvite({
      id: SEED_INVITE_IDS.WAITING_SLOT_3,
      groupId: SEED_GROUP_IDS.TOGETHER_WAITING,
      tokenLabel: "waiting-slot-3",
      createdAt: waitingCreatedAt,
      expiresAt: waitingInviteExpiresAt,
    }),
    createInvite({
      id: SEED_INVITE_IDS.MULTI_GUEST_1,
      groupId: SEED_GROUP_IDS.TOGETHER_ACTIVE_MULTI_PAYER,
      memberId: SEED_MEMBER_IDS.MULTI_GUEST_1,
      tokenLabel: "multi-guest-1",
      createdAt: multiCreatedAt,
      expiresAt: multiInviteExpiresAt,
      claimedAt: multiGuest1ClaimedAt,
    }),
    createInvite({
      id: SEED_INVITE_IDS.MULTI_GUEST_2,
      groupId: SEED_GROUP_IDS.TOGETHER_ACTIVE_MULTI_PAYER,
      memberId: SEED_MEMBER_IDS.MULTI_GUEST_2,
      tokenLabel: "multi-guest-2",
      createdAt: multiCreatedAt,
      expiresAt: multiInviteExpiresAt,
      claimedAt: multiGuest2ClaimedAt,
    }),
    createInvite({
      id: SEED_INVITE_IDS.MULTI_GUEST_3,
      groupId: SEED_GROUP_IDS.TOGETHER_ACTIVE_MULTI_PAYER,
      memberId: SEED_MEMBER_IDS.MULTI_GUEST_3,
      tokenLabel: "multi-guest-3",
      createdAt: multiCreatedAt,
      expiresAt: multiInviteExpiresAt,
      claimedAt: multiGuest3ClaimedAt,
    }),
  ];
  const guestSessions = [
    createGuestSession({
      id: SEED_GUEST_SESSION_IDS.MULTI_GUEST_1,
      groupId: SEED_GROUP_IDS.TOGETHER_ACTIVE_MULTI_PAYER,
      memberId: SEED_MEMBER_IDS.MULTI_GUEST_1,
      tokenLabel: "multi-guest-1-session",
      createdAt: multiGuest1ClaimedAt,
      expiresAt: multiGuestSessionExpiresAt,
    }),
    createGuestSession({
      id: SEED_GUEST_SESSION_IDS.MULTI_GUEST_2,
      groupId: SEED_GROUP_IDS.TOGETHER_ACTIVE_MULTI_PAYER,
      memberId: SEED_MEMBER_IDS.MULTI_GUEST_2,
      tokenLabel: "multi-guest-2-session",
      createdAt: multiGuest2ClaimedAt,
      expiresAt: multiGuestSessionExpiresAt,
    }),
    createGuestSession({
      id: SEED_GUEST_SESSION_IDS.MULTI_GUEST_3,
      groupId: SEED_GROUP_IDS.TOGETHER_ACTIVE_MULTI_PAYER,
      memberId: SEED_MEMBER_IDS.MULTI_GUEST_3,
      tokenLabel: "multi-guest-3-session",
      createdAt: multiGuest3ClaimedAt,
      expiresAt: multiGuestSessionExpiresAt,
    }),
  ];
  const seedDocuments = {
    expenseGroups,
    groupMembers,
    receipts,
    payments,
    invites,
    guestSessions,
  };

  await validateSeedDocuments(seedDocuments);

  return seedDocuments;
}

function createSeedPreview(seedDocuments) {
  return {
    source: "anonymized Atlas fixtures plus synthetic feature scenarios",
    writesToDatabase: false,
    collections: {
      expense_group: seedDocuments.expenseGroups.length,
      group_member: seedDocuments.groupMembers.length,
      receipts: seedDocuments.receipts.length,
      payment: seedDocuments.payments.length,
      invite: seedDocuments.invites.length,
      guest_session: seedDocuments.guestSessions.length,
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
      const groupInvites = seedDocuments.invites.filter(
        (invite) => invite.group_id === group._id,
      );
      const groupGuestSessions = seedDocuments.guestSessions.filter(
        (guestSession) => guestSession.group_id === group._id,
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
        inviteCount: groupInvites.length,
        guestSessionCount: groupGuestSessions.length,
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

async function replaceSeedCollection({
  db,
  collectionName,
  documents,
  session,
}) {
  const writeResult = await db
    .collection(collectionName)
    .bulkWrite(createReplaceOperations(documents), { session });
  const currentIds = documents.map((document) => document._id);
  const deleteResult = await db.collection(collectionName).deleteMany(
    {
      "seed_metadata.namespace": SEED_NAMESPACE,
      _id: { $nin: currentIds },
    },
    { session },
  );

  return {
    matched: writeResult.matchedCount,
    upserted: writeResult.upsertedCount,
    removedStale: deleteResult.deletedCount,
  };
}

async function ensureDevelopmentIndexes(db) {
  await db.collection("group_member").createIndex(
    { group_id: 1 },
    { name: "group_member_group_id" },
  );
  await db.collection("group_member").createIndex(
    { group_id: 1, member_type: 1 },
    {
      name: "group_member_one_registered_owner",
      unique: true,
      partialFilterExpression: { member_type: "registered" },
    },
  );
  await db.collection("receipts").createIndex(
    { group_id: 1 },
    { name: "receipts_group_id" },
  );
  await db.collection("receipts").createIndex(
    { "items._id": 1 },
    { name: "receipts_item_id", unique: true },
  );
  await db.collection("payment").createIndex(
    { group_id: 1 },
    { name: "payment_group_id" },
  );
  await db.collection("payment").createIndex(
    { receipt_id: 1, expense_item_id: 1, payer_member_id: 1 },
    { name: "payment_one_per_item_consumer", unique: true },
  );
  await db.collection("invite").createIndex(
    { group_id: 1 },
    { name: "invite_group_id" },
  );
  await db.collection("invite").createIndex(
    { token_hash: 1 },
    { name: "invite_token_hash", unique: true },
  );
  await db.collection("invite").createIndex(
    { expires_at: 1 },
    { name: "invite_expires_at", expireAfterSeconds: 0 },
  );
  await db.collection("guest_session").createIndex(
    { group_id: 1, member_id: 1 },
    { name: "guest_session_group_member" },
  );
  await db.collection("guest_session").createIndex(
    { token_hash: 1 },
    { name: "guest_session_token_hash", unique: true },
  );
  await db.collection("guest_session").createIndex(
    { expires_at: 1 },
    { name: "guest_session_expires_at", expireAfterSeconds: 0 },
  );
}

function getSeedWriteConfiguration(environment) {
  if (environment.NODE_ENV === "production") {
    throw new Error("Seed writes are not allowed when NODE_ENV is production.");
  }

  if (environment.ALLOW_DATABASE_SEED !== "true") {
    throw new Error('Set ALLOW_DATABASE_SEED="true" to allow a seed write.');
  }

  const uri = environment.MONGODB_URI;
  const databaseName = environment.MONGODB_DB?.trim();
  const allowedDatabaseName = environment.SEED_ALLOWED_DATABASE?.trim();
  const ownerEmail = environment.SEED_OWNER_EMAIL?.trim().toLowerCase();

  if (!uri || !databaseName || !allowedDatabaseName || !ownerEmail) {
    throw new Error(
      "MONGODB_URI, MONGODB_DB, SEED_ALLOWED_DATABASE, and SEED_OWNER_EMAIL are required for --write.",
    );
  }

  if (databaseName !== allowedDatabaseName) {
    throw new Error(
      "SEED_ALLOWED_DATABASE must exactly match MONGODB_DB before writing.",
    );
  }

  return {
    uri,
    databaseName,
    ownerEmail,
  };
}

async function writeSeedDocuments() {
  const { uri, databaseName, ownerEmail } = getSeedWriteConfiguration(
    process.env,
  );
  const client = new MongoClient(uri, {
    appName: "DutchPaySeed",
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
    const collectionDefinitions = [
      ["expense_group", seedDocuments.expenseGroups],
      ["group_member", seedDocuments.groupMembers],
      ["receipts", seedDocuments.receipts],
      ["payment", seedDocuments.payments],
      ["invite", seedDocuments.invites],
      ["guest_session", seedDocuments.guestSessions],
    ];
    await ensureDevelopmentIndexes(db);
    const session = client.startSession();
    let collectionResults = {};

    try {
      await session.withTransaction(async () => {
        const transactionResults = {};

        for (const [collectionName, documents] of collectionDefinitions) {
          transactionResults[collectionName] = await replaceSeedCollection({
            db,
            collectionName,
            documents,
            session,
          });
        }

        collectionResults = transactionResults;
      });
    } finally {
      await session.endSession();
    }

    console.log(
      JSON.stringify(
        {
          databaseName,
          betterAuthUsersModified: 0,
          transactionCommitted: true,
          collections: collectionResults,
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
  SEED_GUEST_SESSION_IDS,
  SEED_INVITE_IDS,
  SEED_ITEM_IDS,
  SEED_MEMBER_IDS,
  SEED_PAYMENT_IDS,
  SEED_RECEIPT_IDS,
  buildSeedDocuments,
  createSeedPreview,
  getSeedWriteConfiguration,
  parseSeedCommand,
};
