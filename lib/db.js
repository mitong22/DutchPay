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
