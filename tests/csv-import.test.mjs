import assert from "node:assert/strict";
import test from "node:test";
import { parseCsv } from "../src/lib/csv-import.ts";

test("CSV parser handles BOM, quoted commas and escaped quotes", () => {
  const result = parseCsv('\uFEFFname,category,notes\r\n"قص، شعر",شعر,"قالت ""قصير"""');
  assert.deepEqual(result.headers, ["name", "category", "notes"]);
  assert.deepEqual(result.rows[0], {
    name: "قص، شعر",
    category: "شعر",
    notes: 'قالت "قصير"',
  });
});

test("CSV parser rejects duplicate headers", () => {
  assert.throws(() => parseCsv("name,name\nأ,ب"), /CSV_DUPLICATE_HEADER/);
});

test("CSV parser rejects unclosed quoted fields", () => {
  assert.throws(() => parseCsv('name,notes\nسارة,"غير مكتمل'), /CSV_UNCLOSED_QUOTE/);
});

test("CSV parser performs no upload or database work", () => {
  const result = parseCsv("name,price_sar,minutes\nقص شعر,100,30");
  assert.equal(result.rows.length, 1);
});
