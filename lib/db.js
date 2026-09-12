import "server-only";

// import { setServers } from "node:dns/promises";
// setServers(["1.1.1.1", "8.8.8.8"]);



import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB;

if (!uri) {
  throw new Error("MONGODB_URI is not set.");
}

if (!databaseName) {
  throw new Error("MONGODB_DB is not set.");
}

const mongoClient =
  globalThis.__dutchPayMongoClient ?? new MongoClient(uri);

if (process.env.NODE_ENV !== "production") {
  globalThis.__dutchPayMongoClient = mongoClient;
}

export const client = mongoClient;
export const db = client.db(databaseName);

export async function connectDb() {
  await client.connect();
}

export async function close() {
  await client.close();
}

// Teacher: 함수를 인자로 받는 공통 처리입니다. 호출부가 async (session) => { ... }를 넘기고 withTransaction이 그 함수를 실행합니다. AI에게 createReceipt의 호출 순서로 펼쳐 달라고 해 보세요. 여기서 session은 로그인 세션이 아닌 MongoDB 작업 묶음이며 각 DB 명령에 전달해야 함께 처리됩니다.
export async function runInTransaction(work) {
  if (typeof work !== "function") {
    throw new TypeError("work must be a function.");
  }

  await connectDb();
  const session = client.startSession();

  try {
    return await session.withTransaction(() => work(session));
  } finally {
    await session.endSession();
  }
}
