export type SpreadsheetRows = Record<string, string>[];

export type ExcelAdapter = {
  parse(buffer: ArrayBuffer): Promise<SpreadsheetRows>;
};

export async function parseExcel(
  buffer: ArrayBuffer,
  adapter?: ExcelAdapter,
): Promise<SpreadsheetRows> {
  if (!adapter) throw new Error("EXCEL_ADAPTER_NOT_CONFIGURED");
  const rows = await adapter.parse(buffer);
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), String(value ?? "").trim()]),
    ),
  );
}
