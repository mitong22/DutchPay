import "server-only";

import { createHash, randomBytes } from "node:crypto";

export function createSecureToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSecureToken(token) {
  if (typeof token !== "string" || token.length === 0) {
    throw new TypeError("token must be a non-empty string.");
  }

  return createHash("sha256").update(token).digest("hex");
}
