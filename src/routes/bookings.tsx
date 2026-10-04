import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { CustomerShell } from "@/components/glam/shells";
import { EmptyState } from "@/components/glam/ui";
import {
  startCustomerBookingsLoad,
  type CustomerBookingsState,
} from "@/repositories/customer-bookings";

export const Route = createFileRoute("/bookings")({ component: BookingsPage });
function BookingsPage() {
  const [state, setState] = useState<CustomerBookingsState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => startCustomerBookingsLoad(supabase, setState), [attempt]);
  return (
    <CustomerShell title="حجوزاتي">
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/"
          className="grid size-9 place-items-center rounded-full border bg-card"
          aria-label="العودة للرئيسية"
        >
          <ArrowRight className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">حجوزاتي</h1>
          <p className="text-sm text-muted-foreground">مواعيدك وتجاربك، في مكان واحد</p>
        </div>
      </div>
      {state.status === "loading" && <p role="status">جارٍ تحميل حجوزاتك…</p>}
      {state.status === "error" && (
        <div role="alert" className="glam-card space-y-4 p-6">
          <p>تعذر تحميل حجوزاتك. حاولي مرة أخرى.</p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            إعادة المحاولة
          </button>
        </div>
      )}
      {state.status === "anonymous" && (
        <EmptyState
          icon={CalendarDays}
          title="حجوزاتك بانتظارك"
          desc="سجّلي الدخول لمتابعة مواعيدك."
          action={
            <Link
              to="/login"
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
            >
              تسجيل الدخول
            </Link>
          }
        />
      )}
      {state.status === "ready" && state.bookings.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title="ما عندك حجوزات إلى الآن"
          desc="اكتشفي الصالون المناسب لك، واختاري خدمتك وموعدك."
          action={
            <Link
              to="/"
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
            >
              اكتشفي الصالونات
            </Link>
          }
        />
      )}
      {state.status === "ready" && state.bookings.length > 0 && (
        <div className="glam-card divide-y">
          {state.bookings.map((booking) => (
            <div className="flex items-center gap-3 p-4" key={booking.id}>
              <CalendarDays className="size-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="font-medium">{booking.salon}</p>
                <p className="text-sm text-muted-foreground">
                  {booking.service} · {booking.date} · {booking.time}
                </p>
              </div>
              <span className="mr-auto shrink-0 rounded-full bg-success/10 px-2 py-1 text-xs text-success">
                {booking.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </CustomerShell>
  );
}
