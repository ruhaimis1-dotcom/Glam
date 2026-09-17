import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, ArrowRight, Clock3 } from "lucide-react";
import { CustomerShell } from "@/components/glam/shells";
import { EmptyState } from "@/components/glam/ui";

export const Route = createFileRoute("/bookings")({ component: BookingsPage });

function BookingsPage() {
  return (
    <CustomerShell title="حجوزاتي">
      <div className="mb-6 flex items-center gap-3">
        <Link to="/" className="grid size-9 place-items-center rounded-full border bg-card" aria-label="العودة للرئيسية">
          <ArrowRight className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">حجوزاتي</h1>
          <p className="text-sm text-muted-foreground">تابعي مواعيدك وتجاربك مع Glam</p>
        </div>
      </div>
      <EmptyState
        icon={CalendarDays}
        title="لا توجد حجوزات حالياً"
        desc="ابدئي باكتشاف الصالون المناسب لك، ثم اختاري الخدمة والموعد."
        action={<Link to="/" className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">اكتشفي الصالونات</Link>}
      />
      <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Clock3 className="size-4" /> الحجز الإلكتروني سيُفعّل بعد ربط قاعدة البيانات
      </div>
    </CustomerShell>
  );
}
