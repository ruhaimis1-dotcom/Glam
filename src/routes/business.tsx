import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { CalendarDays, Users, Scissors, TrendingUp } from "lucide-react";
import { BusinessShell, PageHeader } from "@/components/glam/shells";

export const Route = createFileRoute("/business")({ component: BusinessPage });

const stats = [
  { label: "حجوزات اليوم", value: "24", hint: "+12%", Icon: CalendarDays },
  { label: "العميلات الجدد", value: "18", hint: "هذا الشهر", Icon: Users },
  { label: "الخدمات النشطة", value: "16", hint: "متاحة للحجز", Icon: Scissors },
  { label: "الإيراد المتوقع", value: "12,840 ر.س", hint: "هذا الشهر", Icon: TrendingUp },
] as const;

function BusinessPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname !== "/business") return <Outlet />;

  return (
    <BusinessShell>
      <PageHeader title="لوحة تحكم الصالون" desc="نظرة سريعة على أداء لوميير ستوديو" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, hint, Icon }) => (
          <div key={label} className="glam-card p-4">
            <Icon className="size-5 text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
            <p className="mt-1 text-xs text-success">{hint}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Link to="/business/schedule" className="glam-card p-5 hover:border-primary">
          <h2 className="font-bold">جدول اليوم</h2>
          <p className="mt-1 text-sm text-muted-foreground">إدارة المواعيد والوصولات</p>
        </Link>
        <Link to="/business/services" className="glam-card p-5 hover:border-primary">
          <h2 className="font-bold">الخدمات والأسعار</h2>
          <p className="mt-1 text-sm text-muted-foreground">تحديث الخدمات المتاحة</p>
        </Link>
        <Link to="/business/staff" className="glam-card p-5 hover:border-primary">
          <h2 className="font-bold">فريق العمل</h2>
          <p className="mt-1 text-sm text-muted-foreground">إدارة الموظفات والتخصصات</p>
        </Link>
      </div>
    </BusinessShell>
  );
}
