import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import { redactClientLog } from "@/lib/client-log.mjs";

const LOG_DIRECTORY = join(process.cwd(), "logs");
const LOG_FILE = join(LOG_DIRECTORY, "client-errors.log");

export async function POST(request) {
  if (process.env.NODE_ENV === "production") {
    return new Response(null, { status: 404 });
  }

  const origin = request.headers.get("origin");
  try {
    if (!origin || new URL(origin).host !== request.headers.get("host")) {
      return Response.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
    }
  } catch {
    return Response.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  }

  if (Number(request.headers.get("content-length") || 0) > 16_384) {
    return Response.json({ error: "로그가 너무 큽니다." }, { status: 413 });
  }

  const body = await request.text();
  if (body.length > 16_384) {
    return Response.json({ error: "로그가 너무 큽니다." }, { status: 413 });
  }

  let input;
  try {
    input = JSON.parse(body);
  } catch {
    return Response.json({ error: "잘못된 로그입니다." }, { status: 400 });
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return Response.json({ error: "잘못된 로그입니다." }, { status: 400 });
  }

  const entry = {
    time: new Date().toISOString(),
    area: redactClientLog(input.area, 80),
    path: redactClientLog(input.path, 500),
    message: redactClientLog(input.message, 1_000),
    stack: redactClientLog(input.stack, 4_000),
    userAgent: redactClientLog(input.userAgent, 500),
    ...(Number.isInteger(input.status) ? { status: input.status } : {}),
  };
  if (!entry.message) {
    return Response.json({ error: "오류 메시지가 없습니다." }, { status: 400 });
  }

  console.error(`[client-error:${entry.area || "unknown"}] ${entry.path}: ${entry.message}\n${entry.stack}`);
  try {
    await mkdir(LOG_DIRECTORY, { recursive: true });
    await appendFile(LOG_FILE, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (error) {
    console.error("[client-log-write-failed]", error);
  }
  return new Response(null, { status: 204 });
}
