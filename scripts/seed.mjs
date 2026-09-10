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
  user: "seed-user-miyeon",
  activeGroup: "seed-group-active",
  completedGroup: "seed-group-completed",
  activeCaptain: "seed-member-active-miyeon",
  jihyun: "seed-member-active-jihyun",
  sumin: "seed-member-active-sumin",
  completedCaptain: "seed-member-completed-miyeon",
  minjae: "seed-member-completed-minjae",
  dinnerReceipt: "seed-receipt-dinner",
  cafeReceipt: "seed-receipt-cafe",
  dinnerItem: "seed-item-dinner",
  drinkItem: "seed-item-drink",
  cafeItem: "seed-item-cafe",
};

const dates = {
  activeCreated: new Date("2026-09-09T09:00:00.000Z"),
  activeActivated: new Date("2026-09-09T09:10:00.000Z"),
  activeReceipt: new Date("2026-09-09T10:00:00.000Z"),
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
    nickname: "미연",
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
    nickname: "미연",
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
    db.collection("guest_session").createIndex({ token_hash: 1 }, { unique: true }),
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
  await upsertDocuments(db, "user", [
    {
      _id: ids.user,
      name: "미연",
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
