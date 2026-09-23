/* eslint-disable @typescript-eslint/no-explicit-any -- legacy booking payloads are read from local storage. */
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, ArrowRight } from "lucide-react";
import { readStored, writeStored } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { bookingDate, bookingTime } from "@/lib/booking-time";
import { useEffect, useState } from "react";
import { CustomerShell } from "@/components/glam/shells";
import { EmptyState } from "@/components/glam/ui";

export const Route = createFileRoute("/bookings")({ component: BookingsPage });

function BookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  useEffect(() => {
    let currentUserId: string | null = null;
    const refreshLocal = () =>
      setBookings(
        readStored<any[]>("glam-bookings", []).filter((booking) =>
          currentUserId ? booking.customer_id === currentUserId : !booking.customer_id,
        ),
      );
    window.addEventListener("glam-bookings-updated", refreshLocal);
    window.addEventListener("storage", refreshLocal);
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      currentUserId = user?.id ?? null;
      refreshLocal();
      if (!user) return;
      const { data } = await supabase
        .from("glam_reservations")
        .select("id,status,appointment_id,glam_appointments(salon_name,service_name,starts_at)")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });
      if (data?.length) {
        const remote = data.map((b: any) => ({
          id: b.id,
          customer_id: user.id,
          salon: b.glam_appointments?.salon_name ?? "Glam",
          service: b.glam_appointments?.service_name ?? "خدمة",
          date: b.glam_appointments?.starts_at
            ? bookingDate(b.glam_appointments.starts_at)
            : "",
          time: b.glam_appointments?.starts_at
            ? bookingTime(b.glam_appointments.starts_at)
            : "",
          status: b.status === "confirmed" ? "مؤكد" : b.status,
        }));
        setBookings(remote);
        writeStored("glam-bookings", remote);
      }
    });
    return () => {
      window.removeEventListener("glam-bookings-updated", refreshLocal);
      window.removeEventListener("storage", refreshLocal);
    };
  }, []);
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
          <p className="text-sm text-muted-foreground">تابعي مواعيدك وتجاربك مع Glam</p>
        </div>
      </div>
      {bookings.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title="لا توجد حجوزات حالياً"
          desc="ابدئي باكتشاف الصالون المناسب لك، ثم اختاري الخدمة والموعد."
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
      {bookings.length > 0 && (
        <div className="glam-card divide-y">
          {bookings.map((b) => (
            <div className="flex items-center gap-3 p-4" key={b.id}>
              <CalendarDays className="size-5 text-primary" />
              <div>
                <p className="font-medium">{b.salon}</p>
                <p className="text-sm text-muted-foreground">
                  {b.service} · {b.date} · {b.time}
                </p>
              </div>
              <span className="mr-auto rounded-full bg-success/10 px-2 py-1 text-xs text-success">
                {b.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </CustomerShell>
  );
}
