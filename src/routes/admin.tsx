import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, CalendarCheck, AlertTriangle, Users, TrendingUp } from "lucide-react";
import { AdminShell, PageHeader } from "@/components/glam/shells";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin")({ component: AdminPage });

type AdminStats = {
  organizations: number | null;
  bookings: number | null;
  disputes: number | null;
  customers: number | null;
};

function AdminPage() {
  const [stats, setStats] = useState<AdminStats>({
    organizations: null,
    bookings: null,
    disputes: null,
    customers: null,
  });
  const [status, setStatus] = useState<"loading" | "ready" | "partial">("loading");

  useEffect(() => {
    let active = true;
    void Promise.all([
      supabase.from("glam_organizations").select("id", { count: "exact", head: true }),
      supabase.from("glam_reservations").select("id", { count: "exact", head: true }),
      supabase
        .from("glam_disputes")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      supabase.from("glam_profiles").select("user_id", { count: "exact", head: true }),
    ]).then((results) => {
      if (!active) return;
      const [organizations, bookings, disputes, customers] = results;
      setStats({
        organizations: organizations.error ? null : (organizations.count ?? 0),
        bookings: bookings.error ? null : (bookings.count ?? 0),
        disputes: disputes.error ? null : (disputes.count ?? 0),
        customers: customers.error ? null : (customers.count ?? 0),
      });
      setStatus(results.some((result) => result.error) ? "partial" : "ready");
    });
    return () => {
      active = false;
    };
  }, []);

  const value = (count: number | null) => (count === null ? "غير متاح" : String(count));

  return (
    <AdminShell>
      <PageHeader title="مؤشرات المنصة" desc="بيانات تشغيلية مباشرة من Glam" />
      {status === "loading" && <p role="status" className="mb-4">جارٍ تحميل المؤشرات…</p>}
      {status === "partial" && (
        <p role="alert" className="glam-card mb-4 p-4 text-sm text-muted-foreground">
          بعض المؤشرات غير متاحة بسبب صلاحيات القراءة الحالية. لا يتم عرض بيانات تجريبية بديلة.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {([
          ["الجهات المسجلة", value(stats.organizations), Building2],
          ["الحجوزات", value(stats.bookings), CalendarCheck],
          ["النزاعات المفتوحة", value(stats.disputes), AlertTriangle],
          ["الحسابات", value(stats.customers), Users],
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
          مؤشر الإيراد غير معروض في هذه النسخة لأن الدفع خارج نطاق MVP الحالي، لذلك لن نعرض رقمًا
          تقديريًا أو تجريبيًا.
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
