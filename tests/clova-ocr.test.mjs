import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  parseClovaReceipt,
  randomClovaReceipt,
} from "../lib/clova-ocr.mjs";

function generalPayload(lines) {
  return { images: [{ inferResult: "SUCCESS", fields: lines.flatMap((cells, row) =>
    cells.map(([inferText, x]) => ({ inferText, boundingPoly: { vertices: [
      { x, y: row * 50 }, { x: x + 80, y: row * 50 },
      { x: x + 80, y: row * 50 + 30 }, { x, y: row * 50 + 30 },
    ] } }))) }] };
}

test("GS25 회귀: 전화번호와 사업자번호를 제외하고 할인 후 결제액을 구분한다", () => {
  // Screenshot-derived synthetic OCR rows, not a recorded CLOVA response.
  const receipt = parseClovaReceipt(generalPayload([
    [["GS25포곡골든점", 20], ["0313321182", 700]],
    [["박지훈", 20], ["6388900924", 700]],
    [["2021/10/31 김*숙", 20], ["NO:14522", 700]],
    [["마늘빅프랑크", 20], ["1", 500], ["2,100", 700]],
    [["예거라들러레몬", 20], ["1", 500], ["3,300", 700]],
    [["마운틴블라스트", 20], ["1", 500], ["2,100", 700]],
    [["합계수량/금액", 20], ["3", 500], ["7,500", 700]],
    [["판촉/팝 할인", 20], ["-420", 700]],
    [["과세 매출", 20], ["6,436", 700]],
    [["부가세", 20], ["644", 700]],
    [["합 계", 20], ["7,080", 700]],
    [["신용 카드", 20], ["7,080", 700]],
    [["승인번호", 20], ["30037044", 700]],
  ]));
  assert.equal(receipt.store_name, "GS25포곡골든점");
  assert.equal(receipt.items.length, 3);
  assert.deepEqual(receipt.items.map(i => i.unit_price), [2100, 3300, 2100]);
  assert.equal(receipt.total_amount, 7080);
  assert.equal(receipt.items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0), 7500);
});

test("상품 수량 없이 이름과 식별번호만 있으면 메뉴를 지어내지 않는다", () => {
  assert.throws(() => parseClovaReceipt(generalPayload([
    [["GS25포곡골든점", 20], ["031-332-1182", 700]],
    [["박지훈", 20], ["6388900924", 700]],
    [["2021/10/31 김*숙", 20], ["14522", 700]],
  ])), /메뉴를 찾지/);
});

test("CLOVA 영수증 응답을 메뉴 입력값으로 바꾼다", () => {
  const receipt = parseClovaReceipt({
    images: [{
      inferResult: "SUCCESS",
      receipt: { result: {
        storeInfo: { name: { text: "OO식당" } },
        subResults: [{ items: [
          {
            name: { formatted: { value: "삼겹살" } },
            count: { text: "2" },
            price: {
              price: { formatted: { value: "30000" } },
              unitPrice: { text: "15,000" },
            },
          },
          {
            name: { text: "소주" },
            count: { text: "2" },
            price: { price: { text: "6,000원" } },
          },
        ] }],
        totalPrice: { price: { formatted: { value: "36000" } } },
      } },
    }],
  });

  assert.deepEqual(receipt, {
    store_name: "OO식당",
    total_amount: 36000,
    items: [
      { menu_name: "삼겹살", quantity: 2, unit_price: 15000 },
      { menu_name: "소주", quantity: 2, unit_price: 3000 },
    ],
  });
});

test("CLOVA General OCR의 표 좌표에서 메뉴를 찾는다", () => {
  const field = (inferText, x, y) => ({
    inferText,
    boundingPoly: { vertices: [
      { x, y },
      { x: x + 80, y },
      { x: x + 80, y: y + 30 },
      { x, y: y + 30 },
    ] },
  });
  const receipt = parseClovaReceipt({ images: [{
    inferResult: "SUCCESS",
    fields: [
      field("CU", 20, 10),
      field("청주수곡사랑점", 120, 10),
      field("POS-01", 600, 100),
      field("코코넛초코링N", 100, 160),
      field("1", 500, 160),
      field("1,000", 700, 160),
      field("스트로베리필드N", 100, 220),
      field("2", 500, 220),
      field("2,400", 700, 220),
      field("총구매액", 100, 300),
      field("3", 500, 300),
      field("3,400", 700, 300),
    ],
  }] });

  assert.deepEqual(receipt, {
    store_name: "CU 청주수곡사랑점",
    total_amount: 3400,
    items: [
      { menu_name: "코코넛초코링N", quantity: 1, unit_price: 1000 },
      { menu_name: "스트로베리필드N", quantity: 2, unit_price: 1200 },
    ],
  });
});

test("90개 General OCR 목업 중 입력 가능한 영수증을 고른다", async () => {
  const payloads = JSON.parse(
    await readFile(
      new URL("../seed/clova_general_raw_90_array.json", import.meta.url),
      "utf8",
    ),
  );
  const receipt = randomClovaReceipt(payloads, () => 0);

  assert.ok(receipt.store_name);
  assert.ok(receipt.items.length);
  assert.ok(
    receipt.items.every(
      (item) => item.menu_name && item.quantity > 0 && item.unit_price > 0,
    ),
  );
});
