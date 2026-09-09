function text(field) {
  const value = field?.formatted?.value ?? field?.text ?? field;
  return value == null ? "" : String(value).trim();
}

function integer(field) {
  const token = text(field).replace(/[₩원\s]/g, "");
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(token)) return 0;
  const value = Number(token.replaceAll(",", ""));
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function generalRows(fields) {
  const cells = fields
    .map((field) => {
      const vertices = field.boundingPoly?.vertices ?? [];
      if (!vertices.length) return null;
      const xs = vertices.map((point) => point.x);
      const ys = vertices.map((point) => point.y);
      return {
        text: text(field.inferText),
        x: (Math.min(...xs) + Math.max(...xs)) / 2,
        y: (Math.min(...ys) + Math.max(...ys)) / 2,
        height: Math.max(...ys) - Math.min(...ys),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.y - right.y || left.x - right.x);
  const heights = cells.map((cell) => cell.height).sort((a, b) => a - b);
  const tolerance = Math.max(8, (heights[Math.floor(heights.length / 2)] || 24) / 3);

  return cells.reduce((rows, cell) => {
    const row = rows.at(-1);
    if (!row || Math.abs(row.y - cell.y) > tolerance) {
      rows.push({ y: cell.y, cells: [cell] });
    } else {
      row.cells.push(cell);
      row.y = row.cells.reduce((sum, value) => sum + value.y, 0) / row.cells.length;
    }
    return rows;
  }, []).map((row) => row.cells.sort((left, right) => left.x - right.x));
}

function parseGeneralReceipt(image) {
  const rows = generalRows(image.fields ?? []);
  const rowText = (row) => row.map((cell) => cell.text).join(" ");
  const compact = (row) => rowText(row).replace(/\s/g, "");
  const summary = /^(?:[*※]?)(?:총구매액|총금액|합계|합계수량|결제금액|과세|면세|부가세|판촉|할인|신용카드|받을금액|받은금액|거스름)/i;
  const totalIndex = rows.findIndex((row) => summary.test(compact(row)));
  const end = totalIndex < 0 ? rows.length : totalIndex;
  let start = Math.max(0, end - 30);
  for (let index = 0; index < end; index += 1) {
    if (/(POS[-:]?\d|상품명|품명|MENU|ITEM)/i.test(compact(rows[index]))) start = index + 1;
  }

  const maxX = Math.max(1, ...rows.flat().map((cell) => cell.x));
  const items = rows.slice(start, end).flatMap((row) => {
    const priceIndex = row.findLastIndex(
      (cell) => cell.x > maxX * 0.6 && integer(cell.text) > 0 && integer(cell.text) <= 10_000_000,
    );
    if (priceIndex < 1) return [];

    const beforePrice = row.slice(0, priceIndex);
    const quantityIndex = beforePrice.findLastIndex((cell) => {
      const value = integer(cell.text);
      return /^\d+$/.test(cell.text) && value >= 1 && value <= 999;
    });
    // A name followed by an arbitrary number is often a phone/business ID.
    // Require an explicit quantity column before accepting a product row.
    if (quantityIndex < 0) return [];
    const quantity = integer(beforePrice[quantityIndex].text);
    const nameCells = quantityIndex < 0
      ? beforePrice
      : beforePrice.slice(0, quantityIndex);
    const name = nameCells
      .filter((cell) => !/^\d[\d,]*$/.test(cell.text))
      .map((cell) => cell.text)
      .join(" ")
      .trim();
    if (!name || /(사업자|전화|TEL|승인|카드번호|부가세|과세|영수증|합계|할인|포인트|주소|교환|환불|현금영수증)/i.test(name) || /\d{2,4}[/.:-]\d{1,2}[/.:-]\d{1,4}/.test(name)) return [];

    const lineTotal = integer(row[priceIndex].text);
    if (lineTotal % quantity !== 0) return [];
    return [{ menu_name: name, quantity, unit_price: lineTotal / quantity }];
  });
  if (!items.length) throw new Error("영수증에서 메뉴를 찾지 못했어요.");

  const storeRow = rows.slice(0, end).find(
    (row) => /(식당|카페|마트|스토어|점|restaurant|cafe|mart|store)/i.test(rowText(row)),
  );
  const totals = rows.slice(end).filter((row) => /^(?:[*※]?)(?:합계|결제금액|받을금액|총구매액|총금액)/.test(compact(row)));
  const totalRow = totals.findLast((row) => /^(?:[*※]?)(?:합계|결제금액|받을금액)/.test(compact(row)) && !/^합계수량/.test(compact(row))) ?? totals[0] ?? [];
  return {
    store_name: storeRow ? storeRow.filter((cell) => !/^[\d\s()+.-]+$/.test(cell.text)).map((cell) => cell.text).join(" ") : "",
    total_amount: totalRow.length ? integer(totalRow.at(-1).text) : 0,
    items,
  };
}

export function parseClovaReceipt(payload) {
  const image = payload?.images?.[0];
  if (image?.inferResult !== "SUCCESS") {
    throw new Error("영수증에서 내용을 인식하지 못했어요.");
  }
  if (!image.receipt?.result) return parseGeneralReceipt(image);

  const result = image.receipt.result;
  const items = (result.subResults ?? [])
    .flatMap((group) => group.items ?? [])
    .map((item) => {
      const menuName = text(item.name);
      let quantity = integer(item.count) || 1;
      let unitPrice = integer(item.price?.unitPrice);
      const lineTotal = integer(item.price?.price);

      if (!unitPrice && lineTotal) {
        if (lineTotal % quantity === 0) unitPrice = lineTotal / quantity;
        else {
          quantity = 1;
          unitPrice = lineTotal;
        }
      }

      return { menu_name: menuName, quantity, unit_price: unitPrice };
    })
    .filter((item) => item.menu_name);

  if (!items.length) throw new Error("영수증에서 메뉴를 찾지 못했어요.");

  return {
    store_name: text(result.storeInfo?.name),
    total_amount: integer(result.totalPrice?.price),
    items,
  };
}

export function randomClovaReceipt(payloads, random = Math.random) {
  const receipts = (Array.isArray(payloads) ? payloads : []).flatMap((payload) => {
    try {
      const receipt = parseClovaReceipt(payload);
      const usable =
        receipt.store_name &&
        receipt.items.length &&
        receipt.items.every(
          (item) => item.menu_name && item.quantity > 0 && item.unit_price > 0,
        );
      return usable ? [receipt] : [];
    } catch {
      return [];
    }
  });
  if (!receipts.length) throw new Error("사용할 수 있는 목업 영수증이 없어요.");
  return receipts[Math.floor(random() * receipts.length)];
}
