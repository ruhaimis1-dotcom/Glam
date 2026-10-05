export type ImportKind = "services" | "customers";

export type ImportIssue = {
  row: number;
  field: string;
  code: "required" | "invalid" | "duplicate" | "forbidden";
  message: string;
};

export type ServiceImportRow = {
  name: string;
  priceSar: number;
  minutes: number;
  category?: string;
  active: boolean;
};

export type CustomerImportRow = {
  name: string;
  email?: string;
  phone?: string;
};

const FORBIDDEN_CUSTOMER_FIELDS = [
  "consent",
  "consent_scopes",
  "passport_consent",
  "photo_consent",
  "sensitivities_consent",
];

export function validateServiceRows(rows: Record<string, unknown>[]) {
  const issues: ImportIssue[] = [];
  const seen = new Set<string>();
  const valid: ServiceImportRow[] = [];
  rows.forEach((row, index) => {
    const number = index + 2;
    const name = String(row["name"] ?? "").trim();
    const price = Number(row["price_sar"]);
    const minutes = Number(row["minutes"]);
    const key = name.toLocaleLowerCase("ar");
    if (!name) issues.push({ row: number, field: "name", code: "required", message: "اسم الخدمة مطلوب." });
    if (!Number.isFinite(price) || price < 0) issues.push({ row: number, field: "price_sar", code: "invalid", message: "السعر غير صالح." });
    if (!Number.isInteger(minutes) || minutes <= 0) issues.push({ row: number, field: "minutes", code: "invalid", message: "المدة غير صالحة." });
    if (name && seen.has(key)) issues.push({ row: number, field: "name", code: "duplicate", message: "الخدمة مكررة داخل الملف." });
    seen.add(key);
    if (!issues.some((issue) => issue.row === number)) {
      valid.push({
        name,
        priceSar: price,
        minutes,
        category: String(row["category"] ?? "").trim() || undefined,
        active: String(row["active"] ?? "true").toLowerCase() !== "false",
      });
    }
  });
  return { valid, issues };
}

export function validateCustomerRows(rows: Record<string, unknown>[]) {
  const issues: ImportIssue[] = [];
  const valid: CustomerImportRow[] = [];
  rows.forEach((row, index) => {
    const number = index + 2;
    for (const field of FORBIDDEN_CUSTOMER_FIELDS) {
      if (field in row && String(row[field] ?? "").trim()) {
        issues.push({
          row: number,
          field,
          code: "forbidden",
          message: "لا يمكن استيراد موافقة جواز الجمال. الموافقة تصدر من العميلة فقط.",
        });
      }
    }
    const name = String(row["name"] ?? "").trim();
    const email = String(row["email"] ?? "").trim();
    const phone = String(row["phone"] ?? "").trim();
    if (!name) issues.push({ row: number, field: "name", code: "required", message: "اسم العميلة مطلوب." });
    if (!email && !phone) issues.push({ row: number, field: "email/phone", code: "required", message: "يلزم بريد أو رقم جوال." });
    if (!issues.some((issue) => issue.row === number)) {
      valid.push({ name, email: email || undefined, phone: phone || undefined });
    }
  });
  return { valid, issues };
}
