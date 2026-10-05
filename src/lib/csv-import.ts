export type CsvParseResult = {
  headers: string[];
  rows: Record<string, string>[];
};

export function parseCsv(text: string): CsvParseResult {
  const input = text.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i]!;
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n") {
      record.push(field.replace(/\r$/, ""));
      if (record.some((value) => value.trim())) records.push(record);
      record = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error("CSV_UNCLOSED_QUOTE");
  record.push(field.replace(/\r$/, ""));
  if (record.some((value) => value.trim())) records.push(record);
  if (!records.length) return { headers: [], rows: [] };

  const headers = records[0]!.map((value) => value.trim().toLowerCase());
  if (headers.some((header) => !header)) throw new Error("CSV_EMPTY_HEADER");
  if (new Set(headers).size !== headers.length) throw new Error("CSV_DUPLICATE_HEADER");

  const rows = records.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""])),
  );
  return { headers, rows };
}
