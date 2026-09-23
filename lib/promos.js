const { PRODUCTS } = require("./catalog");

const SHEET_ID = "1qkHoYUkzK5hXIJKjfxkeH3uCBJr2F5qgyyvzPQD6H94";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error("Незакрытая кавычка в таблице промокодов");
  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
  }
  return rows;
}

function parsePromoTable(csv) {
  const rows = parseCsv(csv.replace(/^\uFEFF/, ""));
  if (rows.length < 9) throw new Error("В таблице нужны строки для баллов от 0 до 7");
  const headers = rows[0].map((value) => value.trim());
  const indices = PRODUCTS.map((product) => headers.indexOf(product.sheetHeader));
  if (indices.some((index) => index < 0)) throw new Error("Не найдены колонки продуктов в таблице");

  const table = new Map();
  for (const row of rows.slice(1)) {
    const match = /^([0-7])\s+балл/.exec((row[0] || "").trim());
    if (!match) continue;
    const score = Number(match[1]);
    if (table.has(score)) throw new Error(`Повторяется строка для ${score} баллов`);
    const codes = new Map();
    PRODUCTS.forEach((product, productIndex) => {
      const code = (row[indices[productIndex]] || "").trim();
      if (!code) throw new Error(`Нет промокода для ${score} баллов и ${product.label}`);
      codes.set(product.id, code);
    });
    table.set(score, codes);
  }
  if (table.size !== 8) throw new Error("В таблице должны быть баллы от 0 до 7");
  return table;
}

async function getPromoCode(score, productId) {
  if (!Number.isInteger(score) || score < 0 || score > 7) throw new Error("Некорректные баллы");
  if (!PRODUCTS.some((product) => product.id === productId)) throw new Error("Некорректный продукт");
  const response = await fetch(CSV_URL, { signal: AbortSignal.timeout(8000), headers: { Accept: "text/csv" } });
  if (!response.ok) throw new Error(`Таблица промокодов недоступна: ${response.status}`);
  const table = parsePromoTable(await response.text());
  return table.get(score).get(productId);
}

module.exports = { CSV_URL, parseCsv, parsePromoTable, getPromoCode };
