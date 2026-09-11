import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { MongoClient } from "mongodb";

const HOST = "127.0.0.1";
const PORT = 27018;
const REPLICA_SET = "dutchpay-rs";
const LOCAL_ROOT = path.join(process.cwd(), ".local", "mongodb");
const DATA_PATH = path.join(LOCAL_ROOT, "data");
const LOG_PATH = path.join(LOCAL_ROOT, "mongod.log");
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

function findMongod() {
  const candidates = [process.env.MONGOD_PATH, "mongod"];

  if (process.platform === "darwin") {
    candidates.push("/opt/homebrew/bin/mongod", "/usr/local/bin/mongod");
  }

  if (process.platform === "win32") {
    const serverRoot = path.join(
      process.env.ProgramFiles ?? "C:\\Program Files",
      "MongoDB",
      "Server",
    );

    if (existsSync(serverRoot)) {
      const versions = readdirSync(serverRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

      candidates.push(
        ...versions.map((version) =>
          path.join(serverRoot, version, "bin", "mongod.exe"),
        ),
      );
    }
  }

  for (const candidate of candidates.filter(Boolean)) {
    const installed = spawnSync(candidate, ["--version"], { stdio: "ignore" });

    if (!installed.error && installed.status === 0) return candidate;
  }

  throw new Error(
    "mongod를 찾을 수 없습니다. MongoDB Community Server를 설치하고 PATH에 추가해 주세요.",
  );
}

async function startProcess() {
  const mongod = findMongod();

  mkdirSync(DATA_PATH, { recursive: true });

  const child = spawn(
    mongod,
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
      "--logpath",
      LOG_PATH,
    ],
    { detached: true, stdio: "ignore", windowsHide: true },
  );

  await new Promise((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });
  child.unref();
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
  let running = await readHello();

  if (running && running.setName !== REPLICA_SET) {
    throw new Error(`${PORT} 포트를 다른 MongoDB가 사용 중입니다.`);
  }

  if (!running) {
    await startProcess();

    for (let attempt = 0; attempt < 40; attempt += 1) {
      running = await readHello();
      if (running) break;
      await wait(250);
    }

    if (!running) {
      throw new Error(`mongod 실행에 실패했습니다. 로그: ${LOG_PATH}`);
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
