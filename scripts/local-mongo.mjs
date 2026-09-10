import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { MongoClient } from "mongodb";

const HOST = "127.0.0.1";
const PORT = 27018;
const REPLICA_SET = "dutchpay-rs";
const LOCAL_ROOT = path.join(process.cwd(), ".local", "mongodb");
const DATA_PATH = path.join(LOCAL_ROOT, "data");
const LOG_PATH = path.join(LOCAL_ROOT, "mongod.log");
const PID_PATH = path.join(LOCAL_ROOT, "mongod.pid");
const DIRECT_URI = `mongodb://${HOST}:${PORT}/?directConnection=true`;
const APP_URI = `mongodb://${HOST}:${PORT}/?replicaSet=${REPLICA_SET}`;

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function readHello(timeout = 500) {
  const client = new MongoClient(DIRECT_URI, {
    serverSelectionTimeoutMS: timeout,
  });

  try {
    await client.connect();
    return await client.db("admin").command({ hello: 1 });
  } catch {
    return null;
  } finally {
    await client.close();
  }
}

async function waitForPrimary() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const hello = await readHello();

    if (hello?.setName === REPLICA_SET && hello.isWritablePrimary) {
      return;
    }

    await wait(250);
  }

  throw new Error("로컬 MongoDB가 Primary 상태가 되지 않았습니다.");
}

function startProcess() {
  const installed = spawnSync("mongod", ["--version"], { stdio: "ignore" });

  if (installed.error || installed.status !== 0) {
    throw new Error("mongod를 찾을 수 없습니다. 로컬 MongoDB 설치가 필요합니다.");
  }

  mkdirSync(DATA_PATH, { recursive: true });

  const result = spawnSync(
    "mongod",
    [
      "--dbpath",
      DATA_PATH,
      "--port",
      String(PORT),
      "--bind_ip",
      HOST,
      "--replSet",
      REPLICA_SET,
      "--oplogSize",
      "128",
      "--fork",
      "--logpath",
      LOG_PATH,
      "--pidfilepath",
      PID_PATH,
    ],
    { encoding: "utf8" },
  );

  if (result.error || result.status !== 0) {
    const message = result.stderr?.trim() || result.stdout?.trim();
    throw new Error(message || `mongod 실행에 실패했습니다. 로그: ${LOG_PATH}`);
  }
}

async function initializeReplicaSet() {
  const client = new MongoClient(DIRECT_URI, { serverSelectionTimeoutMS: 5000 });

  try {
    await client.connect();

    try {
      await client.db("admin").command({ replSetGetStatus: 1 });
    } catch (error) {
      if (error.codeName !== "NotYetInitialized") {
        throw error;
      }

      await client.db("admin").command({
        replSetInitiate: {
          _id: REPLICA_SET,
          members: [{ _id: 0, host: `${HOST}:${PORT}` }],
        },
      });
    }
  } finally {
    await client.close();
  }
}

async function start() {
  const running = await readHello();

  if (running && running.setName !== REPLICA_SET) {
    throw new Error(`${PORT} 포트를 다른 MongoDB가 사용 중입니다.`);
  }

  if (!running) {
    startProcess();

    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (await readHello()) break;
      await wait(250);
    }
  }

  await initializeReplicaSet();
  await waitForPrimary();
  console.log(`로컬 MongoDB 준비 완료: ${APP_URI}`);
}

async function status() {
  const hello = await readHello();

  if (!hello) {
    throw new Error("DutchPay 로컬 MongoDB가 실행 중이 아닙니다.");
  }

  console.log(
    JSON.stringify({
      uri: APP_URI,
      replicaSet: hello.setName ?? null,
      primary: Boolean(hello.isWritablePrimary),
    }),
  );
}

async function stop() {
  const hello = await readHello();

  if (!hello) {
    console.log("DutchPay 로컬 MongoDB는 이미 종료되어 있습니다.");
    return;
  }

  if (hello.setName !== REPLICA_SET) {
    throw new Error(`${PORT} 포트의 MongoDB는 DutchPay 인스턴스가 아닙니다.`);
  }

  const client = new MongoClient(DIRECT_URI, { serverSelectionTimeoutMS: 2000 });

  try {
    await client.connect();
    await client.db("admin").command({ shutdown: 1 });
  } catch (error) {
    if (!String(error.message).includes("connection")) throw error;
  } finally {
    await client.close().catch(() => {});
  }

  console.log("DutchPay 로컬 MongoDB를 종료했습니다.");
}

const actions = { start, status, stop };
const action = process.argv[2] ?? "start";

if (!actions[action]) {
  throw new Error("사용법: node scripts/local-mongo.mjs <start|status|stop>");
}

await actions[action]();
