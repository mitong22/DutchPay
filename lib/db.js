import "server-only";

import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB;

if (!uri) {
  throw new Error("MONGODB_URI is not set.");
}

export const client = new MongoClient(uri);
export const db = client.db(databaseName);

export async function connectDb(){
  await client.connect();
};

export async function close(){
  await client.close();
};
