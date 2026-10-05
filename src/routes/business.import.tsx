import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BusinessShell, PageHeader } from "@/components/glam/shells";
import { useBusinessOrganization } from "@/lib/business-context";
import { supabase } from "@/lib/supabase";
import { createImportCommitRepository } from "@/repositories/import-commit";
import {\n  validateCustomerRows,\n  validateServiceRows,\n  type ImportIssue,\n} from "@/domain/import-pipeline";
import { parseCsv } from "@/lib/csv-import";
import { parseExcel } from "@/lib/excel-import";

export const Route = createFileRoute("/business/import")({ component: ImportPage });

const commitRepository = createImportCommitRepository(supabase);

function ImportPage() {
  const organization = useBusinessOrganization();
  const [kind, setKind] = useState<"services" | "customers">("services");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");
  const [committing, setCommitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  async function selectFile(file?: File) {
    setRows([]);
    setIssues([]);
    setMessage("");
    setFileName(file?.name ?? "");
    setConfirmed(false);
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

  async function commitImport() {
    if (!rows.length || issues.length || !confirmed || committing) return;
    const validation =
      kind === "services" ? validateServiceRows(rows) : validateCustomerRows(rows);
    if (validation.issues.length) {
      setIssues(validation.issues);
      setConfirmed(false);
      return;
    }
    setCommitting(true);
    setMessage("");
    try {
      const result = await commitRepository.commit(organization.id, kind, validation.valid);
      setMessage(
        `تم تأكيد الدفعة ${result.batchId}: ${result.accepted} ناجح، ${result.rejected} مرفوض.`,
      );
      setConfirmed(false);
    } catch (error) {
      setMessage(
        error instanceof Error && error.message === "IMPORT_COMMIT_NOT_ENABLED"
          ? "الاستيراد الفعلي غير مفعّل قبل بوابة الـMVP. المعاينة والتحقق فقط متاحان الآن."
          : "لم يتم تأكيد الاستيراد. لم نعتبر أي صف ناجحًا.",
      );
    } finally {
      setCommitting(false);
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
                setConfirmed(false);
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

        {message && (\n          <p role="alert" className="glam-card p-4 text-sm">\n            {message}\n          </p>\n        )}

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
                  <p\n                    key={`${issue.row}-${issue.field}-${index}`}\n                    className="rounded-xl border p-3 text-sm"\n                  >
                    الصف {issue.row} · {issue.field}: {issue.message}
                  </p>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm">الملف اجتاز التحقق الأولي. لم يتم استيراده بعد.</p>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  <span>راجعت الملف وأؤكد استيراد هذه الصفوف إلى المؤسسة الحالية فقط.</span>
                </label>
                <button
                  type="button"
                  disabled={!confirmed || committing}
                  onClick={() => void commitImport()}
                  className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {committing ? "جارٍ التأكيد…" : "تأكيد الاستيراد"}
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </BusinessShell>
  );
}
