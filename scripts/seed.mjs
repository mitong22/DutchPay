import process from "node:process";

import { hashPassword } from "better-auth/crypto";
import { MongoClient } from "mongodb";

import { TEST_LOGIN_PASSWORD } from "../lib/testAccount.mjs";
import { buildSeedDocuments } from "./seed-data.mjs";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB;
const datasetName = process.argv[2] ?? "demo";
const LOCAL_DATABASE = "dutchpay_dev";

if (!uri || !databaseName) {
  throw new Error("로컬 개발용 MongoDB 환경변수가 설정되지 않았습니다.");
}

const parsedUri = new URL(uri);
const isLocal = ["127.0.0.1", "localhost", "[::1]"].includes(parsedUri.hostname);

if (!isLocal || databaseName !== LOCAL_DATABASE) {
  throw new Error(`seed는 로컬 ${LOCAL_DATABASE} DB에서만 실행할 수 있습니다.`);
}

async function upsertDocuments(db, collectionName, documents) {
  if (documents.length === 0) return;

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
    db
      .collection("user")
      .createIndex({ username: 1 }, { unique: true, sparse: true }),
    db.collection("account").createIndex({ userId: 1 }),
    db.collection("session").createIndex({ token: 1 }, { unique: true }),
    db.collection("session").createIndex({ userId: 1 }),
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
  const hello = await client.db("admin").command({ hello: 1 });

  if (hello.setName !== "dutchpay-rs") {
    throw new Error("로컬 MongoDB Replica Set이 준비되지 않았습니다.");
  }

  const passwordHash = await hashPassword(TEST_LOGIN_PASSWORD);
  const seed = buildSeedDocuments(datasetName, passwordHash);
  const db = client.db(databaseName);

  await db.dropDatabase();
  await createIndexes(db);
  await upsertDocuments(db, "user", seed.users);
  await upsertDocuments(db, "account", seed.accounts);
  await upsertDocuments(db, "expense_group", seed.groups);
  await upsertDocuments(db, "group_member", seed.members);
  await upsertDocuments(db, "receipts", seed.receipts);
  await upsertDocuments(db, "payment", seed.payments);

  console.log(
    JSON.stringify(
      {
        database: databaseName,
        dataset: seed.label,
        login: seed.login,
        inserted: {
          users: seed.users.length,
          groups: seed.groups.length,
          members: seed.members.length,
          receipts: seed.receipts.length,
          payments: seed.payments.length,
        },
      },
      null,
      2,
    ),
  );
} finally {
  await client.close();
}
