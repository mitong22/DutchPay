import "server-only";

import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is not set.");
}

export const client =
  globalThis._mongoClient ?? new MongoClient(uri);

if (process.env.NODE_ENV !== "production") {
  globalThis._mongoClient = client;
}

export const db = client.db("dutchpay");
