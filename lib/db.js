import "server-only";

import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB;

if (!uri || !databaseName) {
  throw new Error("MONGODB_URI and MONGODB_DB must be set.");
}

const mongoGlobal = globalThis;

export const client = mongoGlobal.dutchPayMongoClient ?? new MongoClient(uri);

if (process.env.NODE_ENV !== "production") {
  mongoGlobal.dutchPayMongoClient = client;
}

export const db = client.db(databaseName);

// Atlas 연결만으로 데이터가 바뀌지는 않는다.
// 실제 저장은 서버 전용 Route Handler에서 insertOne/updateOne/deleteOne을 호출할 때 일어난다.
// Client Component는 이 파일을 직접 가져오지 않고 /api/... 경로를 통해 요청해야 한다.

export function connectDb() {
  return client.connect();
}

export function close() {
  return client.close();
}
