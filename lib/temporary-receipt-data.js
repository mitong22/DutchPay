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

// Teacher: 현재 임시 OCR 기능은 사진을 전송하는 API가 아니라 seed 폴더에 저장된 JSON을 읽어 입력 초안을 만드는 기능입니다. 여기서는 DB 초기화도 하지 않습니다. AI에게 파일 읽기 → 무작위 결과 선택 → 초안 변환 → Action 반환 → 화면 반영의 호출 순서를 정리하게 해 보세요.
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
