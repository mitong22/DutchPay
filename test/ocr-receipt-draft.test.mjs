import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createReceiptDraftFromClovaResult,
  getOriginalClovaReceiptResults,
} from "../lib/ocr-receipt-draft.mjs";

const ocrFileUrl = new URL(
  "../seed/clova_general_raw_90_array.json",
  import.meta.url,
);
const allOcrResults = JSON.parse(await readFile(ocrFileUrl, "utf8"));
const originalOcrResults = getOriginalClovaReceiptResults(allOcrResults);

function findOriginalResult(sourceName) {
  return originalOcrResults.find(
    (ocrResult) => ocrResult.images[0].name === sourceName,
  );
}

test("temporary OCR data contains 50 originals and excludes transformed copies", () => {
  assert.equal(allOcrResults.length, 90);
  assert.equal(originalOcrResults.length, 50);
  assert.equal(
    originalOcrResults.some((ocrResult) =>
      ocrResult.images[0].name.includes("__"),
    ),
    false,
  );
});

test("a CU OCR result becomes an editable store and menu draft", () => {
  const receiptDraft = createReceiptDraftFromClovaResult(
    findOriginalResult("01_IMG00111"),
  );

  assert.deepEqual(receiptDraft, {
    sourceName: "01_IMG00111",
    storeName: "CU 청주수곡사랑점",
    items: [
      { menuName: "코코넛초코링N", lineTotal: 1000 },
      { menuName: "스트로베리필드N", lineTotal: 2400 },
    ],
  });
});

test("a headerless Daiso OCR result uses its POS item rows", () => {
  const receiptDraft = createReceiptDraftFromClovaResult(
    findOriginalResult("17_IMG00106"),
  );

  assert.equal(receiptDraft.storeName, "(주)아성다이소_청주산남2호점");
  assert.equal(receiptDraft.items.length, 5);
  assert.equal(
    receiptDraft.items.reduce((total, item) => total + item.lineTotal, 0),
    6500,
  );
});

test("slanted Homeplus columns keep each amount with the correct item", () => {
  const receiptDraft = createReceiptDraftFromClovaResult(
    findOriginalResult("50_IMG00681"),
  );

  assert.deepEqual(receiptDraft.items.slice(0, 4), [
    { menuName: "레이즈케찹맛감자", lineTotal: 4990 },
    { menuName: "청주성안점_재사용", lineTotal: 600 },
    { menuName: "우유케이크", lineTotal: 1000 },
    { menuName: "오레오시나몬번", lineTotal: 1690 },
  ]);
});

test("every original OCR result produces a receipt draft accepted by form limits", () => {
  for (const ocrResult of originalOcrResults) {
    const receiptDraft = createReceiptDraftFromClovaResult(ocrResult);

    assert.ok(receiptDraft, ocrResult.images[0].name);
    assert.ok(receiptDraft.storeName.length >= 1);
    assert.ok(receiptDraft.storeName.length <= 80);
    assert.ok(receiptDraft.items.length >= 1);
    assert.ok(receiptDraft.items.length <= 50);

    for (const item of receiptDraft.items) {
      assert.ok(item.menuName.length >= 1);
      assert.ok(item.menuName.length <= 80);
      assert.ok(Number.isSafeInteger(item.lineTotal));
      assert.ok(item.lineTotal > 0);
      assert.equal(item.lineTotal % 10, 0);
    }
  }
});

test("an unsuccessful Clova result is not converted", () => {
  assert.equal(
    createReceiptDraftFromClovaResult({
      images: [
        {
          name: "failed-receipt",
          inferResult: "FAILURE",
          fields: [],
        },
      ],
    }),
    null,
  );
});
