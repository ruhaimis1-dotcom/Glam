import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BusinessShell, PageHeader } from "@/components/glam/shells";
import { validateCustomerRows, validateServiceRows, type ImportIssue } from "@/domain/import-pipeline";
import { parseCsv } from "@/lib/csv-import";
import { parseExcel } from "@/lib/excel-import";

export const Route = createFileRoute("/business/import")({ component: ImportPage });

function ImportPage() {
  const [kind, setKind] = useState<"services" | "customers">("services");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");

  async function selectFile(file?: File) {
    setRows([]);
    setIssues([]);
    setMessage("");
    setFileName(file?.name ?? "");
    if (!file) return;
    try {
      const lower = file.name.toLowerCase();
      const parsedRows = lower.endsWith(".csv")
        ? parseCsv(await file.text()).rows
        : lower.endsWith(".xlsx")
          ? await parseExcel(await file.arrayBuffer())
          : (() => {
              throw new Error("UNSUPPORTED_FILE");
            })();
      const validation =
        kind === "services" ? validateServiceRows(parsedRows) : validateCustomerRows(parsedRows);
      setRows(parsedRows);
      setIssues(validation.issues);
    } catch {
      setMessage(
        file.name.toLowerCase().endsWith(".xlsx")
          ? "Excel مجهز في الواجهة لكنه غير مفعّل حتى اعتماد محرك القراءة ضمن بوابة الـMVP."
          : "تعذر قراءة الملف. تحققي من تنسيق CSV والعناوين.",
      );
    }
  }

  return (
    <BusinessShell>
      <PageHeader
        title="استيراد البيانات"
        desc="راجعي البيانات والأخطاء قبل أي إضافة إلى حساب الصالون"
      />
      <div className="space-y-5">
        <section className="glam-card space-y-4 p-5">
          <label className="block text-sm font-medium">
            نوع البيانات
            <select
              value={kind}
              onChange={(event) => {
                setKind(event.target.value as "services" | "customers");
                setRows([]);
                setIssues([]);
                setFileName("");
              }}
              className="mt-2 w-full rounded-xl border bg-background px-4 py-3"
            >
              <option value="services">الخدمات</option>
              <option value="customers">العملاء</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            ملف CSV
            <input
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => void selectFile(event.target.files?.[0])}
              className="mt-2 block w-full text-sm"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            المعاينة محلية في المتصفح. اختيار الملف لا يضيف أي صف إلى قاعدة البيانات.
          </p>
        </section>

        {message && <p role="alert" className="glam-card p-4 text-sm">{message}</p>}

        {!!rows.length && (
          <section className="glam-card space-y-4 p-5">
            <div>
              <h2 className="font-semibold">معاينة {fileName}</h2>
              <p className="text-sm text-muted-foreground">
                {rows.length} صف — {issues.length} ملاحظة تحتاج مراجعة
              </p>
            </div>
            {issues.length ? (
              <div className="space-y-2">
                {issues.map((issue, index) => (
                  <p key={`${issue.row}-${issue.field}-${index}`} className="rounded-xl border p-3 text-sm">
                    الصف {issue.row} · {issue.field}: {issue.message}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-sm">الملف اجتاز التحقق الأولي. لم يتم استيراده بعد.</p>
            )}
          </section>
        )}
      </div>
    </BusinessShell>
  );
}
