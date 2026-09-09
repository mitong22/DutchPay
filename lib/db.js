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

export function connectDb() {
  return client.connect();
}

export function close() {
  return client.close();
}
