import { createFileRoute } from "@tanstack/react-router";
import { Building2, ShieldCheck, Globe2 } from "lucide-react";
import { AdminShell, PageHeader } from "@/components/glam/shells";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/salons")({ component: AdminSalonsPage });

type SalonRow = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  page_title: string | null;
  address: string | null;
  slug: string | null;
  published: boolean | null;
};

function AdminSalonsPage() {
  const [rows, setRows] = useState<SalonRow[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    setMessage("");
    const { data, error } = await supabase.rpc("glam_admin_salons");
    if (error || data === null) {
      setStatus("error");
      setMessage("تعذر تحميل الجهات بصلاحيات الإدارة الحالية.");
      return;
    }
    setRows(data as SalonRow[]);
    setStatus("ready");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(row: SalonRow) {
    const note = window.prompt(`ملاحظة اعتماد «${row.name}»`, "اعتماد من إدارة Glam");
    if (!note?.trim()) return;
    setMessage("");
    const { error } = await supabase.rpc("glam_approve_salon", {
      p_id: row.id,
      p_note: note.trim(),
    });
    if (error) {
      setMessage("تعذر اعتماد الجهة. تحققي من حالتها وصلاحية حساب الإدارة.");
      return;
    }
    setMessage("تم اعتماد الجهة.");
    await load();
  }

  return (
    <AdminShell>
      <PageHeader title="الصالونات والاعتماد" desc="الجهات الفعلية المسجلة في Glam" />
      {message && <p role="status" className="glam-card mb-4 p-4 text-sm">{message}</p>}
      {status === "loading" && <p role="status">جارٍ تحميل الجهات…</p>}
      {status === "error" && (
        <div className="glam-card space-y-3 p-5">
          <p role="alert">{message || "تعذر تحميل الجهات."}</p>
          <button onClick={() => void load()} className="rounded-full border px-4 py-2 text-sm">
            إعادة المحاولة
          </button>
        </div>
      )}
      {status === "ready" && !rows.length && (
        <div className="glam-card p-5 text-sm text-muted-foreground">لا توجد جهات مسجلة حاليًا.</div>
      )}
      <div className="grid gap-3">
        {rows.map((row) => (
          <article className="glam-card p-4" key={row.id}>
            <div className="flex flex-wrap items-start gap-3">
              <Building2 className="mt-1 size-5 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="font-bold">{row.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {row.page_title || "لا توجد صفحة عامة"}{row.address ? ` · ${row.address}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border px-2.5 py-1">الحالة: {row.status}</span>
                  <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1">
                    <Globe2 className="size-3" />
                    {row.published ? "الصفحة منشورة" : "الصفحة غير منشورة"}
                  </span>
                </div>
              </div>
              {row.status === "pending" ? (
                <button
                  onClick={() => void approve(row)}
                  className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                >
                  <ShieldCheck className="size-3.5" />
                  اعتماد
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-3 py-2 text-xs text-success">
                  <ShieldCheck className="size-3.5" />
                  {row.status === "active" ? "نشط" : row.status}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </AdminShell>
  );
}
