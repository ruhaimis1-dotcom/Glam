import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Users, Scissors, TrendingUp } from "lucide-react";
import { BusinessShell, PageHeader } from "@/components/glam/shells";

export const Route = createFileRoute("/business")({ component: BusinessPage });
function BusinessPage() {
  return (
    <BusinessShell>
      <PageHeader title="لوحة تحكم الصالون" desc="نظرة سريعة على أداء لوميير ستوديو" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["حجوزات اليوم", "24", "+12%", CalendarDays],
            ["العميلات الجدد", "18", "هذا الشهر", Users],
            ["الخدمات النشطة", "16", "متاحة للحجز", Scissors],
            ["الإيراد المتوقع", "12,840 ر.س", "هذا الشهر", TrendingUp],
          ] as const
        ).map(([label, value, hint, Icon]) => (
          <div key={String(label)} className="glam-card p-4">
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
