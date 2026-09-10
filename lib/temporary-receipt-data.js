import "server-only";

import { randomInt } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  createReceiptDraftFromClovaResult,
  getOriginalClovaReceiptResults,
} from "@/lib/ocr-receipt-draft.mjs";

const TEMPORARY_OCR_FILE_PATH = path.join(
  process.cwd(),
  "seed",
  "clova_general_raw_90_array.json",
);

export async function loadRandomTemporaryReceiptDraft() {
  const fileContents = await readFile(TEMPORARY_OCR_FILE_PATH, "utf8");
  const allOcrResults = JSON.parse(fileContents);
  const remainingResults = [...getOriginalClovaReceiptResults(allOcrResults)];

  while (remainingResults.length > 0) {
    const selectedIndex = randomInt(remainingResults.length);
    const [selectedResult] = remainingResults.splice(selectedIndex, 1);
    const receiptDraft = createReceiptDraftFromClovaResult(selectedResult);

    if (receiptDraft) {
      return receiptDraft;
    }
  }

  throw new Error("No usable temporary OCR receipt was found.");
}
