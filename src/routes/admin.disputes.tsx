import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { AdminShell, PageHeader } from "@/components/glam/shells";
export const Route = createFileRoute("/admin/disputes")({ component: AdminDisputesPage });
function AdminDisputesPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [resolved, setResolved] = useState<string[]>([]);
  const disputes = [
    "النتيجة لا تطابق الصورة المتفق عليها · نور بيوتي لاونج",
    "إلغاء من الصالون قبل ساعة بدون إشعار · نيل بار الرياض",
    "خلاف على استرداد العربون · لوميير ستوديو",
  ];
  return (
    <AdminShell>
      <PageHeader title="النزاعات" desc="الحالات التي تحتاج مراجعة" />
      <div className="grid gap-3">
        {disputes.map((x) => (
          <div className="glam-card flex items-center gap-3 p-4" key={x}>
            <AlertTriangle className="size-5 text-warning" />
            <span className={resolved.includes(x) ? "line-through opacity-50" : ""}>{x}</span>
            <button
              onClick={() => setSelected(x)}
              className="mr-auto rounded-full border px-3 py-1.5 text-xs"
            >
              {resolved.includes(x) ? "تمت المعالجة" : "مراجعة"}
            </button>
          </div>
        ))}
      </div>
      {selected && (
        <section className="glam-card mt-4 space-y-3 p-5">
          <h2 className="font-bold">تفاصيل النزاع</h2>
          <p className="text-sm text-muted-foreground">{selected}</p>
          <p className="text-sm">
            الحالة: {resolved.includes(selected) ? "تمت المعالجة" : "بانتظار قرار الإدارة"}
          </p>
          {!resolved.includes(selected) && (
            <button
              onClick={() => {
                setResolved([...resolved, selected]);
                setSelected(null);
              }}
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
