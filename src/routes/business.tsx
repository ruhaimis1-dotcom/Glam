import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { BusinessShell, PageHeader } from "@/components/glam/shells";
import { BusinessAccess } from "@/components/glam/business-access";
import { useBusinessOrganization } from "@/lib/business-context";

export const Route = createFileRoute("/business")({ component: BusinessPage });

function BusinessPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <BusinessAccess>{pathname !== "/business" ? <Outlet /> : <BusinessHome />}</BusinessAccess>
  );
}

function BusinessHome() {
  const organization = useBusinessOrganization();

  return (
    <BusinessShell>
      <PageHeader title="لوحة تحكم الصالون" desc={organization.name} />
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
