import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, CalendarCheck, AlertTriangle, Users, TrendingUp } from "lucide-react";
import { AdminShell, PageHeader } from "@/components/glam/shells";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin")({ component: AdminPage });

type Overview = {
  organizations: number;
  bookings: number;
  open_disputes: number;
  accounts: number;
};

function AdminPage() {
  const [stats, setStats] = useState<Overview | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    void supabase.rpc("glam_admin_overview").then(({ data, error }) => {
      if (!active) return;
      if (error || !data) {
        setStatus("error");
        return;
      }
      setStats(data as Overview);
      setStatus("ready");
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AdminShell>
      <PageHeader title="مؤشرات المنصة" desc="بيانات تشغيلية مباشرة من Glam" />
      {status === "loading" && <p role="status" className="mb-4">جارٍ تحميل المؤشرات…</p>}
      {status === "error" && (
        <p role="alert" className="glam-card mb-4 p-4 text-sm text-destructive">
          تعذر تحميل مؤشرات الإدارة. تحققي من صلاحية Platform Admin.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {([
          ["الجهات المسجلة", stats?.organizations ?? "—", Building2],
          ["الحجوزات", stats?.bookings ?? "—", CalendarCheck],
          ["النزاعات المفتوحة", stats?.open_disputes ?? "—", AlertTriangle],
          ["الحسابات", stats?.accounts ?? "—", Users],
        ] as const).map(([label, metric, Icon]) => (
          <div className="glam-card p-4" key={label}>
            <Icon className="size-5 text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold">{metric}</p>
          </div>
        ))}
      </div>

      <div className="glam-card mt-5 flex items-start gap-3 p-4 text-sm text-muted-foreground">
        <TrendingUp className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          الإيراد غير معروض في MVP لأن الدفع غير مفعّل كمسار إنتاجي حتى الآن، لذلك لا نعرض رقمًا تقديريًا.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Link to="/admin/salons" className="glam-card p-5 hover:border-primary">
          <h2 className="font-bold">الصالونات والاعتماد</h2>
          <p className="mt-1 text-sm text-muted-foreground">الجهات المسجلة وحالة النشر</p>
        </Link>
        <Link to="/admin/bookings" className="glam-card p-5 hover:border-primary">
          <h2 className="font-bold">الحجوزات</h2>
          <p className="mt-1 text-sm text-muted-foreground">سجل العمليات الحقيقي</p>
        </Link>
        <Link to="/admin/disputes" className="glam-card p-5 hover:border-primary">
          <h2 className="font-bold">النزاعات</h2>
          <p className="mt-1 text-sm text-muted-foreground">الحالات التشغيلية المسجلة</p>
        </Link>
      </div>
    </AdminShell>
  );
}
