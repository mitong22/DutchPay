import process from "node:process";

import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB;
const LOCAL_DATABASE = "dutchpay_dev";

if (!uri || !databaseName) {
  throw new Error("MONGODB_URI와 MONGODB_DB를 .env.local에 설정해 주세요.");
}

const parsedUri = new URL(uri);
const isLocal = ["127.0.0.1", "localhost", "[::1]"].includes(parsedUri.hostname);

if (!isLocal || databaseName !== LOCAL_DATABASE) {
  throw new Error(`seed는 로컬 ${LOCAL_DATABASE} DB에서만 실행할 수 있습니다.`);
}

const ids = {
  user: "mock-user-001",
  activeGroup: "seed-group-active",
  completedGroup: "seed-group-completed",
  activeCaptain: "seed-member-active-yunha",
  jihyun: "seed-member-active-jihyun",
  sumin: "seed-member-active-sumin",
  completedCaptain: "seed-member-completed-yunha",
  minjae: "seed-member-completed-minjae",
  dinnerReceipt: "seed-receipt-dinner",
  activeCafeReceipt: "seed-receipt-active-cafe",
  taxiReceipt: "seed-receipt-taxi",
  cafeReceipt: "seed-receipt-cafe",
  dinnerItem: "seed-item-dinner",
  drinkItem: "seed-item-drink",
  coffeeItem: "seed-item-coffee",
  dessertItem: "seed-item-dessert",
  taxiItem: "seed-item-taxi",
  cafeItem: "seed-item-cafe",
};

const dates = {
  activeCreated: new Date("2026-09-09T09:00:00.000Z"),
  activeActivated: new Date("2026-09-09T09:10:00.000Z"),
  activeReceipt: new Date("2026-09-09T10:00:00.000Z"),
  activeCafeReceipt: new Date("2026-09-09T10:30:00.000Z"),
  taxiReceipt: new Date("2026-09-09T11:00:00.000Z"),
  completedCreated: new Date("2026-09-07T05:00:00.000Z"),
  completedActivated: new Date("2026-09-07T05:05:00.000Z"),
  completedReceipt: new Date("2026-09-07T06:00:00.000Z"),
  completedAt: new Date("2026-09-07T07:00:00.000Z"),
};

const members = [
  {
    _id: ids.activeCaptain,
    group_id: ids.activeGroup,
    user_id: ids.user,
    nickname: "윤하",
    member_type: "registered",
  },
  {
    _id: ids.jihyun,
    group_id: ids.activeGroup,
    user_id: null,
    nickname: "지현",
    member_type: "guest",
  },
  {
    _id: ids.sumin,
    group_id: ids.activeGroup,
    user_id: null,
    nickname: "수인",
    member_type: "guest",
  },
  {
    _id: ids.completedCaptain,
    group_id: ids.completedGroup,
    user_id: ids.user,
    nickname: "윤하",
    member_type: "registered",
  },
  {
    _id: ids.minjae,
    group_id: ids.completedGroup,
    user_id: null,
    nickname: "민재",
    member_type: "guest",
  },
];

const groups = [
  {
    _id: ids.activeGroup,
    name: "성수 저녁 모임",
    created_by: ids.user,
    mode: "TOGETHER",
    status: "ACTIVE",
    expected_member_count: 3,
    activated_at: dates.activeActivated,
    settlement_completed_at: null,
    member_ids: [ids.activeCaptain, ids.jihyun, ids.sumin],
    created_at: dates.activeCreated,
  },
  {
    _id: ids.completedGroup,
    name: "주말 카페 정산",
    created_by: ids.user,
    mode: "SOLO",
    status: "ACTIVE",
    expected_member_count: 2,
    activated_at: dates.completedActivated,
    settlement_completed_at: dates.completedAt,
    member_ids: [ids.completedCaptain, ids.minjae],
    created_at: dates.completedCreated,
  },
];

const receipts = [
  {
    _id: ids.dinnerReceipt,
    group_id: ids.activeGroup,
    store_name: "저녁 식사",
    total_amount: 66000,
    paid_by_member_id: ids.activeCaptain,
    uploaded_by_member_id: ids.activeCaptain,
    items: [
      {
        _id: ids.dinnerItem,
        menu_name: "저녁 세트",
        quantity: 3,
        unit_price: 18000,
        line_total: 54000,
        consumer_member_ids: [ids.activeCaptain, ids.jihyun, ids.sumin],
      },
      {
        _id: ids.drinkItem,
        menu_name: "음료",
        quantity: 3,
        unit_price: 4000,
        line_total: 12000,
        consumer_member_ids: [ids.activeCaptain, ids.jihyun, ids.sumin],
      },
    ],
    created_at: dates.activeReceipt,
    updated_at: dates.activeReceipt,
  },
  {
    _id: ids.activeCafeReceipt,
    group_id: ids.activeGroup,
    store_name: "카페",
    total_amount: 21500,
    paid_by_member_id: ids.jihyun,
    uploaded_by_member_id: ids.jihyun,
    items: [
      {
        _id: ids.coffeeItem,
        menu_name: "아메리카노",
        quantity: 2,
        unit_price: 4500,
        line_total: 9000,
        consumer_member_ids: [ids.activeCaptain, ids.jihyun],
      },
      {
        _id: ids.dessertItem,
        menu_name: "디저트",
        quantity: 1,
        unit_price: 12500,
        line_total: 12500,
        consumer_member_ids: [ids.activeCaptain, ids.jihyun, ids.sumin],
      },
    ],
    created_at: dates.activeCafeReceipt,
    updated_at: dates.activeCafeReceipt,
  },
  {
    _id: ids.taxiReceipt,
    group_id: ids.activeGroup,
    store_name: "택시",
    total_amount: 18400,
    paid_by_member_id: ids.sumin,
    uploaded_by_member_id: ids.sumin,
    items: [
      {
        _id: ids.taxiItem,
        menu_name: "택시비",
        quantity: 1,
        unit_price: 18400,
        line_total: 18400,
        consumer_member_ids: [ids.activeCaptain, ids.sumin],
      },
    ],
    created_at: dates.taxiReceipt,
    updated_at: dates.taxiReceipt,
  },
  {
    _id: ids.cafeReceipt,
    group_id: ids.completedGroup,
    store_name: "카페",
    total_amount: 24000,
    paid_by_member_id: ids.completedCaptain,
    uploaded_by_member_id: ids.completedCaptain,
    items: [
      {
        _id: ids.cafeItem,
        menu_name: "커피와 디저트",
        quantity: 2,
        unit_price: 12000,
        line_total: 24000,
        consumer_member_ids: [ids.completedCaptain, ids.minjae],
      },
    ],
    created_at: dates.completedReceipt,
    updated_at: dates.completedReceipt,
  },
];

const payments = receipts.flatMap((receipt) =>
  receipt.items.flatMap((item) =>
    item.consumer_member_ids.map((payerMemberId) => ({
      _id: `seed-payment-${item._id}-${payerMemberId}`,
      group_id: receipt.group_id,
      receipt_id: receipt._id,
      expense_item_id: item._id,
      payer_member_id: payerMemberId,
      payee_member_id: receipt.paid_by_member_id,
      status:
        receipt.group_id === ids.completedGroup ||
        payerMemberId === receipt.paid_by_member_id
          ? "paid"
          : "unpaid",
      created_at: receipt.created_at,
    })),
  ),
);

async function upsertDocuments(db, collectionName, documents) {
  await db.collection(collectionName).bulkWrite(
    documents.map((document) => ({
      replaceOne: {
        filter: { _id: document._id },
        replacement: document,
        upsert: true,
      },
    })),
  );
}

async function createIndexes(db) {
  await Promise.all([
    db.collection("user").createIndex({ email: 1 }, { unique: true }),
    db.collection("expense_group").createIndex({ created_by: 1, created_at: -1 }),
    db.collection("group_member").createIndex({ group_id: 1 }),
    db.collection("group_member").createIndex(
      { group_id: 1, user_id: 1 },
      {
        unique: true,
        partialFilterExpression: { user_id: { $type: "string" } },
      },
    ),
    db.collection("group_invite").createIndex({ token_hash: 1 }, { unique: true }),
    db.collection("group_invite").createIndex(
      { expires_at: 1 },
      { expireAfterSeconds: 0 },
    ),
    db.collection("guest_session").createIndex({ token_hash: 1 }, { unique: true }),
    db.collection("guest_session").createIndex(
      { expires_at: 1 },
      { expireAfterSeconds: 0 },
    ),
    db.collection("receipts").createIndex({ group_id: 1, created_at: -1 }),
    db.collection("payment").createIndex({ group_id: 1, receipt_id: 1 }),
    db.collection("payment").createIndex(
      {
        group_id: 1,
        receipt_id: 1,
        expense_item_id: 1,
        payer_member_id: 1,
        payee_member_id: 1,
      },
      { unique: true },
    ),
  ]);
}

const client = new MongoClient(uri);

try {
  await client.connect();
  const admin = client.db("admin");
  const hello = await admin.command({ hello: 1 });

  if (hello.setName !== "dutchpay-rs") {
    throw new Error("로컬 MongoDB Replica Set이 준비되지 않았습니다.");
  }

  const db = client.db(databaseName);
  await createIndexes(db);
  await db.collection("user").deleteOne({ _id: "seed-user-miyeon" });
  await Promise.all([
    db.collection("group_member").deleteMany({
      group_id: { $in: [ids.activeGroup, ids.completedGroup] },
    }),
    db.collection("receipts").deleteMany({
      group_id: { $in: [ids.activeGroup, ids.completedGroup] },
    }),
    db.collection("payment").deleteMany({
      group_id: { $in: [ids.activeGroup, ids.completedGroup] },
    }),
    db.collection("group_invite").deleteMany({
      group_id: { $in: [ids.activeGroup, ids.completedGroup] },
    }),
    db.collection("guest_session").deleteMany({
      group_id: { $in: [ids.activeGroup, ids.completedGroup] },
    }),
  ]);
  await upsertDocuments(db, "user", [
    {
      _id: ids.user,
      name: "윤하",
      email: "demo@dutchpay.local",
      emailVerified: true,
      createdAt: dates.completedCreated,
      updatedAt: dates.completedCreated,
    },
  ]);
  await upsertDocuments(db, "group_member", members);
  await upsertDocuments(db, "expense_group", groups);
  await upsertDocuments(db, "receipts", receipts);
  await upsertDocuments(db, "payment", payments);

  const counts = Object.fromEntries(
    await Promise.all(
      ["user", "expense_group", "group_member", "receipts", "payment"].map(
        async (collectionName) => [
          collectionName,
          await db.collection(collectionName).countDocuments(),
        ],
      ),
    ),
  );

  console.log(JSON.stringify({ database: databaseName, counts }, null, 2));
} finally {
  await client.close();
}
