import { createFileRoute, Link, Outlet, useMatch } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { CustomerShell } from "@/components/glam/shells";
import { supabase } from "@/lib/supabase";
import {
  startBookingCatalogLoad,
  type BookingCatalogState,
} from "@/repositories/booking-catalog";

export const Route = createFileRoute("/salon/$salonId")({ component: SalonRoute });

function SalonRoute() {
  const booking = useMatch({ from: "/salon/$salonId/book", shouldThrow: false });
  return booking ? <Outlet /> : <SalonPage />;
}

function SalonPage() {
  const { salonId } = Route.useParams();
  const [state, setState] = useState<BookingCatalogState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(
    () => startBookingCatalogLoad(supabase, salonId, setState),
    [salonId, attempt],
  );

  if (state.status === "loading") {
    return (
      <CustomerShell title="الصالون" back="/">
        <p role="status" className="glam-card p-6">جارٍ تحميل الصالون والخدمات…</p>
      </CustomerShell>
    );
  }

  if (state.status === "error") {
    return (
      <CustomerShell title="الصالون" back="/">
        <div className="glam-card p-6">
          <p role="alert">تعذر تحميل بيانات الصالون. لا نعرض بيانات تجريبية بدل البيانات الحقيقية.</p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className="mt-4 rounded-full border px-4 py-2 text-sm"
          >
            إعادة المحاولة
          </button>
        </div>
      </CustomerShell>
    );
  }

  const { salonName, catalog, appointments } = state.data;
  if (!salonName || (!catalog.length && !appointments.length)) {
    return (
      <CustomerShell title="الصالون" back="/">
        <div className="glam-card py-16 text-center">
          <h1 className="text-xl font-bold">لا توجد مواعيد متاحة لهذا الصالون حاليًا</h1>
          <Link
            to="/"
            className="mt-5 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            العودة للرئيسية
          </Link>
        </div>
      </CustomerShell>
    );
  }

  const lowestPrice = catalog.length ? Math.min(...catalog.map((service) => service.price)) : null;

  return (
    <CustomerShell title={salonName} back="/">
      <div className="overflow-hidden rounded-3xl border bg-card">
        <img
          src="/glam/glam-salon-hero.png"
          alt="صالون تجميل"
          className="h-56 w-full object-cover sm:h-72"
        />
        <div className="space-y-5 p-5 sm:p-7">
          <div>
            <h1 className="text-2xl font-bold">{salonName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              الخدمات والمواعيد أدناه مقروءة من نظام الحجز.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {catalog.slice(0, 6).map((service) => (
              <div key={service.id} className="rounded-2xl border p-4">
                <p className="font-medium">{service.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {service.price.toLocaleString("ar-SA-u-nu-latn")} ر.س · {service.minutes} دقيقة
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-muted/50 p-4 text-sm">
            <CalendarDays className="size-5 text-primary" />
            <span>{appointments.length} موعد متاح في النظام</span>
            {lowestPrice !== null && (
              <span className="mr-auto font-medium">
                تبدأ من {lowestPrice.toLocaleString("ar-SA-u-nu-latn")} ر.س
              </span>
            )}
          </div>

          <Link
            to="/salon/$salonId/book"
            params={{ salonId }}
            className="block w-full rounded-2xl bg-primary px-5 py-3.5 text-center font-semibold text-primary-foreground hover:bg-primary/90"
          >
            اختاري الخدمة والموعد
          </Link>
        </div>
      </div>
    </CustomerShell>
  );
}
