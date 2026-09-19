import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { AdminShell, PageHeader } from "@/components/glam/shells";
import { readStored, writeStored } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/disputes")({ component: AdminDisputesPage });
type DisputeRow = { id?: string; summary: string; status: string };
const fallback: DisputeRow[] = [
  { summary: "النتيجة لا تطابق الصورة المتفق عليها · نور بيوتي لاونج", status: "open" },
  { summary: "إلغاء من الصالون قبل ساعة بدون إشعار · نيل بار الرياض", status: "open" },
  { summary: "خلاف على استرداد العربون · لوميير ستوديو", status: "open" },
];

function AdminDisputesPage() {
  const [selected, setSelected] = useState<DisputeRow | null>(null);
  const [disputes, setDisputes] = useState<DisputeRow[]>(() =>
    readStored("glam-disputes", fallback),
  );
  useEffect(() => {
    supabase
      .from("glam_disputes")
      .select("id,summary,status")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data?.length) {
          setDisputes(data);
          writeStored("glam-disputes", data);
        }
      });
  }, []);
  const resolve = async (item: DisputeRow) => {
    if (item.id)
      await supabase
        .from("glam_disputes")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("id", item.id);
    const next = disputes.map((x) => (x === item ? { ...x, status: "resolved" } : x));
    setDisputes(next);
    writeStored("glam-disputes", next);
    setSelected(null);
  };
  return (
    <AdminShell>
      <PageHeader title="النزاعات" desc="الحالات التي تحتاج مراجعة" />
      <div className="grid gap-3">
        {disputes.map((x) => (
          <div className="glam-card flex items-center gap-3 p-4" key={x.id ?? x.summary}>
            <AlertTriangle className="size-5 text-warning" />
            <span className={x.status !== "open" ? "line-through opacity-50" : ""}>
              {x.summary}
            </span>
            <button
              onClick={() => setSelected(x)}
              className="mr-auto rounded-full border px-3 py-1.5 text-xs"
            >
              {x.status !== "open" ? "تمت المعالجة" : "مراجعة"}
            </button>
          </div>
        ))}
      </div>
      {selected && (
        <section className="glam-card mt-4 space-y-3 p-5">
          <h2 className="font-bold">تفاصيل النزاع</h2>
          <p className="text-sm text-muted-foreground">{selected.summary}</p>
          <p className="text-sm">
            الحالة: {selected.status !== "open" ? "تمت المعالجة" : "بانتظار قرار الإدارة"}
          </p>
          {selected.status === "open" && (
            <button
              onClick={() => resolve(selected)}
              className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              اعتماد المعالجة
            </button>
          )}
          <button
            onClick={() => setSelected(null)}
            className="mr-2 rounded-full border px-4 py-2 text-sm"
          >
            إغلاق
          </button>
        </section>
      )}
    </AdminShell>
  );
}
