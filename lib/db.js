import "server-only";

// import { setServers } from "node:dns/promises";
// setServers(["1.1.1.1", "8.8.8.8"]);



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
