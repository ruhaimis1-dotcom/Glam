import assert from "node:assert/strict";
import test from "node:test";
import { parseExcel } from "../src/lib/excel-import.ts";

test("Excel fails closed when no reviewed adapter is configured", async () => {
  await assert.rejects(parseExcel(new ArrayBuffer(0)), /EXCEL_ADAPTER_NOT_CONFIGURED/);
});

test("Excel adapter output is normalized to the same row contract as CSV", async () => {
  const rows = await parseExcel(new ArrayBuffer(1), {
    parse: async () => [{ " Name ": " قص شعر ", PRICE_SAR: 120 }],
  });
  assert.deepEqual(rows, [{ name: "قص شعر", price_sar: "120" }]);
});
