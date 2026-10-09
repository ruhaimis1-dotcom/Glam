import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminShell, PageHeader } from "@/components/glam/shells";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/disputes")({ component: AdminDisputesPage });

type Dispute = {
  id: string;
  organization_id: string;
  summary: string;
  status: string;
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
};

function AdminDisputesPage() {
  const [rows, setRows] = useState<Dispute[]>([]);
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    void supabase.rpc("glam_admin_disputes").then(({ data, error }) => {
      if (!active) return;
      if (error || data === null) {
        setStatus("error");
        return;
      }
      setRows(data as Dispute[]);
      setStatus("ready");
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AdminShell>
      <PageHeader title="النزاعات" desc="الحالات التشغيلية المسجلة فعليًا" />
      {status === "loading" && <p role="status">جارٍ تحميل النزاعات…</p>}
      {status === "error" && (
        <p role="alert" className="glam-card p-5">تعذر تحميل النزاعات بصلاحيات الإدارة الحالية.</p>
      )}
      {status === "ready" && !rows.length && (
        <p className="glam-card p-5 text-muted-foreground">لا توجد نزاعات مسجلة حاليًا.</p>
      )}
      <div className="grid gap-3">
        {rows.map((row) => (
          <div className="glam-card flex items-center gap-3 p-4" key={row.id}>
            <AlertTriangle className="size-5 text-warning" />
            <div className="min-w-0 flex-1">
              <p>{row.summary}</p>
              <p className="mt-1 text-xs text-muted-foreground">الحالة: {row.status}</p>
            </div>
            <button
              onClick={() => setSelected(row)}
              className="rounded-full border px-3 py-1.5 text-xs"
            >
              التفاصيل
            </button>
          </div>
        ))}
      </div>
      {selected && (
        <section className="glam-card mt-4 space-y-3 p-5">
          <h2 className="font-bold">تفاصيل النزاع</h2>
          <p>{selected.summary}</p>
          <p className="text-sm text-muted-foreground">الحالة: {selected.status}</p>
          {selected.resolution_note && (
            <p className="text-sm">ملاحظة المعالجة: {selected.resolution_note}</p>
          )}
          <button onClick={() => setSelected(null)} className="rounded-full border px-4 py-2 text-sm">
            إغلاق
          </button>
        </section>
      )}
    </AdminShell>
  );
}
