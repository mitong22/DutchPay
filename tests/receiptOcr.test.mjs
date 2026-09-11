import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import test from "node:test";

import {
  codexExecutableSearchPath,
  detectImageExtension,
  isReceiptImageKeyForGroup,
  normalizeReceiptAnalysis,
} from "../lib/receiptOcr.mjs";

test("서버를 어디서 실행해도 Codex CLI 기본 위치를 탐색한다", () => {
  const searchDirectories = codexExecutableSearchPath(
    {
      CODEX_INSTALL_DIR: "/custom/codex/bin",
      HOME: "/Users/tester",
      PATH: "/usr/bin:/bin",
    },
    "darwin",
  ).split(path.delimiter);

  assert.ok(searchDirectories.includes("/custom/codex/bin"));
  assert.ok(searchDirectories.includes("/Users/tester/.local/bin"));
  assert.ok(searchDirectories.includes("/Applications/ChatGPT.app/Contents/Resources"));
  assert.ok(searchDirectories.includes("/Applications/Codex.app/Contents/Resources"));
});

test("OCR 결과를 receipts.items 형식과 금액 불변식에 맞춘다", () => {
  const result = normalizeReceiptAnalysis({
    store_name: " 테스트 식당 ",
    total_amount: 99999,
    items: [
      {
        menu_name: "파스타",
        quantity: 2,
        unit_price: 1,
        line_total: 24000,
      },
      {
        menu_name: "음료",
        quantity: 3,
        unit_price: 1,
        line_total: 10000,
      },
    ],
  });

  assert.deepEqual(result, {
    store_name: "테스트 식당",
    total_amount: 34000,
    items: [
      {
        menu_name: "파스타",
        quantity: 2,
        unit_price: 12000,
        line_total: 24000,
      },
      {
        menu_name: "음료",
        quantity: 1,
        unit_price: 10000,
        line_total: 10000,
      },
    ],
  });
});

test("이미지 내용과 모임별 저장 키를 검증한다", () => {
  const groupDirectory = createHash("sha256")
    .update("group-1")
    .digest("hex")
    .slice(0, 32);

  assert.equal(detectImageExtension(Buffer.from([0xff, 0xd8, 0xff])), ".jpg");
  assert.equal(
    detectImageExtension(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ),
    ".png",
  );
  assert.equal(
    isReceiptImageKeyForGroup(
      `${groupDirectory}/123e4567-e89b-12d3-a456-426614174000.jpg`,
      "group-1",
    ),
    true,
  );
  assert.equal(
    isReceiptImageKeyForGroup(
      `${groupDirectory}/../../secret.jpg`,
      "group-1",
    ),
    false,
  );
});
