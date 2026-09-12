import { MAX_RECEIPT_ITEM_COUNT } from "./receipt-rules.mjs";
import { SETTLEMENT_MONEY_UNIT } from "./settlement-rules.mjs";

const MAX_STORE_NAME_LENGTH = 80;
const MAX_MENU_NAME_LENGTH = 80;

const STORE_KEYWORD_PATTERN =
  /(마트|이마트|emart|다이소|홈플러스|homeplus|식품점|케밥|생협|coop|cu\b|매장명|점\b)/i;
const STORE_METADATA_PATTERN =
  /(사업자|대표자?|주소|전화|tel\)?|판매일|거래일|재인쇄|영수증\s*미지참|교환\/환불|소비자중심|품질경영|대기번호|판매담당)/i;
const GENERIC_STORE_TEXT_PATTERN = /^(?:\[?영수증\]?|최근영수증발행인쇄)$/i;
const TABLE_HEADER_NAME_PATTERN = /(상품|제품|품명|강품명)/i;
const TABLE_HEADER_VALUE_PATTERN = /(단가|수량|금액)/i;
const TRANSACTION_START_PATTERN = /(?:\[?\s*pos\b|pos[-:]|판매일|거래일|재인쇄)/i;
const RECEIPT_SUMMARY_PATTERN =
  /(과세|면세|부가세|합\s*계|총\s*(?:합\s*계|구\s*매|수량)|판매\s*합계|상품금액|할인금액|결제대상금액|신용카드|카드\/간편결제|카드결제|현금카드|받은돈|청구액|매출수량)/i;
const DISCOUNT_PATTERN = /(할인|에누리|쿠폰)/i;
const REFERENCE_NUMBER_PATTERN = /^\[?\s*\d{7,}\s*\]?$/;
const MONEY_FIELD_PATTERN = /^[₩￦\s]*-?\d[\d,]*(?:원)?[*#.\s]*$/;

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function getFieldBox(field) {
  const text =
    typeof field?.inferText === "string"
      ? normalizeWhitespace(field.inferText)
      : "";
  const vertices = field?.boundingPoly?.vertices;

  if (!text || !Array.isArray(vertices) || vertices.length === 0) {
    return null;
  }

  const xValues = vertices.map((vertex) => Number(vertex?.x));
  const yValues = vertices.map((vertex) => Number(vertex?.y));

  if (
    xValues.some((value) => !Number.isFinite(value)) ||
    yValues.some((value) => !Number.isFinite(value))
  ) {
    return null;
  }

  const left = Math.min(...xValues);
  const right = Math.max(...xValues);
  const top = Math.min(...yValues);
  const bottom = Math.max(...yValues);

  return {
    text,
    left,
    right,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
    height: Math.max(1, bottom - top),
  };
}

function groupPositionedFields(positionedFields, receiptSlope) {
  const sortedFields = positionedFields
    .map((field) => ({
      ...field,
      lineY: field.centerY - receiptSlope * field.centerX,
    }))
    .sort(
      (firstField, secondField) =>
        firstField.lineY - secondField.lineY ||
        firstField.left - secondField.left,
    );
  const lines = [];

  for (const field of sortedFields) {
    let closestLine = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const line of lines.slice(-8)) {
      const distance = Math.abs(field.lineY - line.lineY);
      const tolerance = Math.max(
        8,
        Math.min(field.height, line.averageHeight) * 0.48,
      );

      if (distance <= tolerance && distance < closestDistance) {
        closestLine = line;
        closestDistance = distance;
      }
    }

    if (!closestLine) {
      closestLine = {
        fields: [],
        lineY: field.lineY,
        averageHeight: field.height,
      };
      lines.push(closestLine);
    }

    closestLine.fields.push(field);
    closestLine.lineY =
      closestLine.fields.reduce(
        (total, currentField) => total + currentField.lineY,
        0,
      ) / closestLine.fields.length;
    closestLine.averageHeight =
      closestLine.fields.reduce(
        (total, currentField) => total + currentField.height,
        0,
      ) / closestLine.fields.length;
  }

  return lines.sort(
    (firstLine, secondLine) => firstLine.lineY - secondLine.lineY,
  );
}

// Teacher: 영수증의 기울기를 추정하려고 좌표 평균·공분산·분산을 계산하는 심화 로직입니다. AI에게 점 (0, 10), (100, 20)으로 slope와 lineY = y - slope × x를 설명하게 해 보세요. 먼저 기울기 0인 영수증의 단순 줄 묶기부터 이해하고 실제 기울어진 샘플로 보정 효과를 비교하세요.
function estimateHeaderSlope(positionedFields) {
  const roughLines = groupPositionedFields(positionedFields, 0);
  const headerLine = roughLines.find((line) => {
    const text = line.fields.map((field) => field.text).join(" ");

    return (
      TABLE_HEADER_NAME_PATTERN.test(text) &&
      TABLE_HEADER_VALUE_PATTERN.test(text)
    );
  });

  if (!headerLine || headerLine.fields.length < 2) {
    return 0;
  }

  const averageX =
    headerLine.fields.reduce((total, field) => total + field.centerX, 0) /
    headerLine.fields.length;
  const averageY =
    headerLine.fields.reduce((total, field) => total + field.centerY, 0) /
    headerLine.fields.length;
  const covariance = headerLine.fields.reduce(
    (total, field) =>
      total + (field.centerX - averageX) * (field.centerY - averageY),
    0,
  );
  const xVariance = headerLine.fields.reduce(
    (total, field) => total + (field.centerX - averageX) ** 2,
    0,
  );

  if (xVariance === 0) {
    return 0;
  }

  const slope = covariance / xVariance;

  return Math.abs(slope) <= 0.5 ? slope : 0;
}

function reconstructLines(fields) {
  const positionedFields = fields.map(getFieldBox).filter(Boolean);
  const receiptSlope = estimateHeaderSlope(positionedFields);

  return groupPositionedFields(positionedFields, receiptSlope)
    .sort((firstLine, secondLine) => firstLine.lineY - secondLine.lineY)
    .map((line) => {
      const sortedFields = line.fields.sort(
        (firstField, secondField) => firstField.left - secondField.left,
      );

      return {
        fields: sortedFields,
        text: normalizeWhitespace(
          sortedFields.map((field) => field.text).join(" "),
        ),
      };
    });
}

function cleanStoreName(value) {
  return normalizeWhitespace(value)
    .replace(/^\[?\s*(?:매장명|영수증)\s*\]?\s*/i, "")
    .replace(/\s+\d{3}-\d{2}-\d{5}.*$/, "")
    .replace(/\s*\(?\d{2,4}\)?[-)]?\d{3,4}-\d{4}.*$/, "")
    .replace(/(?:tel\)?|전화|점포)\s*[:)]?.*$/i, "")
    .replace(/^[-:<>"]+|[-:<>"]+$/g, "")
    .trim()
    .slice(0, MAX_STORE_NAME_LENGTH);
}

// Teacher: 정규식과 점수로 상호명 후보를 추측하는 규칙이라 모든 영수증에 맞는 정답은 아닙니다. AI에게 실제 OCR 한 줄이 각 정규식에서 통과·탈락하는 이유를 풀이하게 하고, 상호명 대신 주소가 선택되는 반례도 찾아보세요. 인식 결과를 사용자가 수정하는 입력 화면이 필요한 이유와 연결됩니다.
function scoreStoreCandidate(line, lineIndex) {
  const candidate = cleanStoreName(line.text);

  if (
    candidate.length < 2 ||
    GENERIC_STORE_TEXT_PATTERN.test(candidate) ||
    STORE_METADATA_PATTERN.test(candidate) ||
    (TABLE_HEADER_NAME_PATTERN.test(candidate) &&
      TABLE_HEADER_VALUE_PATTERN.test(candidate)) ||
    !/[가-힣A-Za-z]/.test(candidate)
  ) {
    return null;
  }

  let score = Math.max(0, 8 - lineIndex * 0.5);

  if (STORE_KEYWORD_PATTERN.test(candidate)) {
    score += 10;
  }

  if (/\(주\)|주\)/.test(candidate)) {
    score += 3;
  }

  if (/청주|점(?:\s|$)/.test(candidate)) {
    score += 3;
  }

  if (/국민가게/i.test(candidate)) {
    score -= 4;
  }

  const digitCount = (candidate.match(/\d/g) || []).length;
  score -= digitCount / Math.max(candidate.length, 1) * 8;

  return { candidate, score };
}

function extractStoreName(lines, itemStartIndex, sourceName) {
  const candidateLines = lines.slice(0, Math.max(1, itemStartIndex));
  const candidates = candidateLines
    .map(scoreStoreCandidate)
    .filter(Boolean)
    .sort((firstCandidate, secondCandidate) => {
      return secondCandidate.score - firstCandidate.score;
    });

  if (candidates.length > 0) {
    return candidates[0].candidate;
  }

  return `OCR 영수증 ${sourceName}`.slice(0, MAX_STORE_NAME_LENGTH);
}

function findItemStartIndex(lines) {
  const headerIndex = lines.findIndex(
    (line) =>
      TABLE_HEADER_NAME_PATTERN.test(line.text) &&
      TABLE_HEADER_VALUE_PATTERN.test(line.text),
  );

  if (headerIndex >= 0) {
    return headerIndex + 1;
  }

  const transactionLineIndex = lines.findIndex((line) =>
    TRANSACTION_START_PATTERN.test(line.text),
  );

  if (transactionLineIndex >= 0) {
    return transactionLineIndex + 1;
  }

  return Math.min(8, lines.length);
}

function findItemEndIndex(lines, itemStartIndex) {
  const relativeEndIndex = lines
    .slice(itemStartIndex)
    .findIndex((line) => RECEIPT_SUMMARY_PATTERN.test(line.text));

  if (relativeEndIndex < 0) {
    return lines.length;
  }

  return itemStartIndex + relativeEndIndex;
}

function parseMoneyField(field) {
  const text = field.text;

  if (
    !MONEY_FIELD_PATTERN.test(text) ||
    REFERENCE_NUMBER_PATTERN.test(text)
  ) {
    return null;
  }

  const normalizedDigits = text.replace(/[^\d-]/g, "");
  const amount = Number(normalizedDigits);

  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    amount % SETTLEMENT_MONEY_UNIT !== 0
  ) {
    return null;
  }

  return amount;
}

function cleanMenuNamePart(value) {
  return value
    .replace(/^\d{1,3}(?:[*#.)-]+|\s+)/, "")
    .replace(/^[*#.)\s]+|[*#.)\s]+$/g, "")
    .trim();
}

function extractMenuName(line, amountField) {
  const nameParts = [];

  for (const field of line.fields) {
    if (amountField && field.left >= amountField.left) {
      break;
    }

    const cleanedPart = cleanMenuNamePart(field.text);

    if (
      !cleanedPart ||
      MONEY_FIELD_PATTERN.test(cleanedPart) ||
      REFERENCE_NUMBER_PATTERN.test(cleanedPart) ||
      /^(?:no\.?|단가|수량|금액)$/i.test(cleanedPart)
    ) {
      continue;
    }

    if (/[가-힣A-Za-z]/.test(cleanedPart)) {
      nameParts.push(cleanedPart);
    }
  }

  const menuName = normalizeWhitespace(nameParts.join(" "));

  if (
    !menuName ||
    RECEIPT_SUMMARY_PATTERN.test(menuName) ||
    DISCOUNT_PATTERN.test(menuName)
  ) {
    return "";
  }

  return menuName.slice(0, MAX_MENU_NAME_LENGTH);
}

function addMenuItem(items, menuName, lineTotal) {
  if (!menuName || !lineTotal || items.length >= MAX_RECEIPT_ITEM_COUNT) {
    return;
  }

  items.push({
    menuName,
    lineTotal,
  });
}

function extractItems(lines, itemStartIndex, itemEndIndex) {
  const items = [];
  let pendingMenuName = "";

  for (const line of lines.slice(itemStartIndex, itemEndIndex)) {
    if (REFERENCE_NUMBER_PATTERN.test(line.text)) {
      continue;
    }

    const amountFields = line.fields
      .map((field) => ({ field, amount: parseMoneyField(field) }))
      .filter((candidate) => candidate.amount !== null);
    const amountCandidate = amountFields.at(-1) || null;
    const lineMenuName = extractMenuName(line, amountCandidate?.field);

    if (amountCandidate && lineMenuName) {
      addMenuItem(items, lineMenuName, amountCandidate.amount);
      pendingMenuName = "";
      continue;
    }

    if (amountCandidate && pendingMenuName) {
      addMenuItem(items, pendingMenuName, amountCandidate.amount);
      pendingMenuName = "";
      continue;
    }

    if (lineMenuName) {
      pendingMenuName = pendingMenuName
        ? `${pendingMenuName} ${lineMenuName}`.slice(0, MAX_MENU_NAME_LENGTH)
        : lineMenuName;
    }
  }

  return items;
}

export function getOriginalClovaReceiptResults(ocrResults) {
  if (!Array.isArray(ocrResults)) {
    throw new TypeError("ocrResults must be an array.");
  }

  return ocrResults.filter((ocrResult) => {
    const image = ocrResult?.images?.[0];

    return (
      image?.inferResult === "SUCCESS" &&
      typeof image.name === "string" &&
      !image.name.includes("__") &&
      Array.isArray(image.fields)
    );
  });
}

export function createReceiptDraftFromClovaResult(ocrResult) {
  const image = ocrResult?.images?.[0];

  if (
    image?.inferResult !== "SUCCESS" ||
    typeof image.name !== "string" ||
    !Array.isArray(image.fields)
  ) {
    return null;
  }

  const lines = reconstructLines(image.fields);
  const itemStartIndex = findItemStartIndex(lines);
  const itemEndIndex = findItemEndIndex(lines, itemStartIndex);
  const items = extractItems(lines, itemStartIndex, itemEndIndex);

  if (items.length === 0) {
    return null;
  }

  return {
    sourceName: image.name,
    storeName: extractStoreName(lines, itemStartIndex, image.name),
    items,
  };
}
