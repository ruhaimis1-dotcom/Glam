/* eslint-disable @typescript-eslint/no-explicit-any -- legacy booking payloads are read from local storage. */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, MapPin, ShieldCheck } from "lucide-react";
import { byId, formatSAR } from "@/data/mock";
import { CustomerShell } from "@/components/glam/shells";
import { PrivacyBadges, SalonCover, Stars } from "@/components/glam/ui";
import { readStored, writeStored } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/salon/$salonId")({ component: SalonPage });

function SalonPage() {
  const { salonId } = Route.useParams();
  const salon = byId.salon(salonId);
  const [service, setService] = useState("بالاياج كامل");
  const [date, setDate] = useState("اليوم");
  const [time, setTime] = useState("5:30 م");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<
    Array<{ id: string; service_name: string; starts_at: string }>
  >([]);
  useEffect(() => {
    supabase
      .from("glam_appointments")
      .select("id,service_name,starts_at")
      .eq("salon_name", salon?.name ?? "")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .then(({ data }) => {
        const rows = (data ?? []) as Array<{
          id: string;
          service_name: string;
          starts_at: string;
        }>;
        setAppointments(rows);
        const first = rows[0];
        if (first) {
          setService(first.service_name);
          setDate(new Date(first.starts_at).toLocaleDateString("ar-SA"));
          setTime(
            new Date(first.starts_at).toLocaleTimeString("ar-SA", {
              hour: "numeric",
              minute: "2-digit",
            }),
          );
          setAppointmentId(first.id);
        }
      });
  }, [salon?.name]);
  const services = [...new Set(appointments.map((a) => a.service_name))];
  const serviceAppointments = appointments.filter((a) => a.service_name === service);
  const confirmBooking = async () => {
    setSaving(true);
    setBookingError("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("AUTH_REQUIRED");
      if (!appointmentId) throw new Error("APPOINTMENT_UNAVAILABLE");
      const { data: existing } = await supabase
        .from("glam_reservations")
        .select("id")
        .eq("appointment_id", appointmentId)
        .eq("customer_id", user.id)
        .eq("status", "confirmed")
        .maybeSingle();
      if (existing) throw new Error("ALREADY_BOOKED");
      const { error } = await supabase.from("glam_reservations").insert({
        id: crypto.randomUUID(),
        appointment_id: appointmentId,
        customer_id: user.id,
        request_id: crypto.randomUUID(),
        status: "confirmed",
        attendance: "pending",
        booking_source: "salon_link",
      });
      if (error) throw error;
      const bookings = readStored<any[]>("glam-bookings", []);
      bookings.unshift({
        id: `GL-${Date.now().toString().slice(-6)}`,
        customer_id: user?.id ?? null,
        salonId,
        salon: salon?.name,
        service,
        date,
        time,
        status: "مؤكد",
      });
      writeStored("glam-bookings", bookings);
      window.dispatchEvent(new Event("glam-bookings-updated"));
      setConfirmed(true);
    } catch {
      setBookingError("تعذر حفظ الحجز في الوقت الحالي. يرجى المحاولة مرة أخرى.");
    } finally {
      setSaving(false);
    }
  };

  if (!salon) {
    return (
      <CustomerShell title="الصالون" back="/">
        <div className="glam-card py-16 text-center">
          <h1 className="text-xl font-bold">الصالون غير موجود</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            قد يكون الرابط غير صحيح أو أن الصالون غير متاح حالياً.
          </p>
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

  return (
    <CustomerShell title={salon.name} back="/">
      <div className="overflow-hidden rounded-3xl border bg-card">
        <SalonCover salon={salon} className="h-56 sm:h-72" />
        <div className="space-y-5 p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{salon.name}</h1>
                {salon.verified && (
                  <ShieldCheck className="size-5 text-primary" aria-label="معتمد" />
                )}
              </div>
              <p className="mt-1 text-muted-foreground">{salon.tagline}</p>
            </div>
            <Stars value={salon.rating} />
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-4 text-primary" />
              {salon.area} · {salon.district}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-4 text-primary" />
              {salon.availableToday ? `متاح ${salon.nextSlot}` : `أقرب موعد ${salon.nextSlot}`}
            </span>
          </div>
          <PrivacyBadges privacy={salon.privacy} />
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">تبدأ الخدمات من</p>
            <p className="mt-1 text-xl font-bold">{formatSAR(salon.priceFrom)}</p>
          </div>
          {confirmed ? (
            <div className="rounded-2xl bg-success/10 p-4 text-center">
              <p className="font-semibold text-success">تم تأكيد الحجز بنجاح</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {service} · {date} · {time}
              </p>
              <Link
                to="/bookings"
                className="mt-3 inline-flex rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground"
              >
                عرض حجوزاتي
              </Link>
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border p-4">
              <p className="font-semibold">اختاري الخدمة والموعد</p>
              <select
                value={service}
                onChange={(e) => {
                  const next = e.target.value;
                  const first = appointments.find((a) => a.service_name === next);
                  setService(next);
                  setAppointmentId(first?.id ?? null);
                  setDate(first ? new Date(first.starts_at).toLocaleDateString("ar-SA") : "");
                  setTime(
                    first
                      ? new Date(first.starts_at).toLocaleTimeString("ar-SA", {
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "",
                  );
                }}
                className="w-full rounded-xl border bg-background px-4 py-3"
              >
                {services.length === 0 && <option value="">لا توجد خدمات متاحة</option>}
                {services.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={appointmentId ?? ""}
                onChange={(e) => {
                  const selected = serviceAppointments.find((a) => a.id === e.target.value);
                  setAppointmentId(selected?.id ?? null);
                  setDate(selected ? new Date(selected.starts_at).toLocaleDateString("ar-SA") : "");
                  setTime(
                    selected
                      ? new Date(selected.starts_at).toLocaleTimeString("ar-SA", {
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "",
                  );
                }}
                className="w-full rounded-xl border bg-background px-4 py-3"
              >
                {serviceAppointments.length === 0 && <option value="">لا توجد مواعيد متاحة</option>}
                {serviceAppointments.map((appointment) => (
                  <option key={appointment.id} value={appointment.id}>
                    {new Date(appointment.starts_at).toLocaleString("ar-SA", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </option>
                ))}
              </select>
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-xl border bg-background px-4 py-3"
              >
                <option value={time}>{time || "--"}</option>
              </select>
              {bookingError && (
                <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                  {bookingError}
                </p>
              )}
              <button
                disabled={saving}
                onClick={confirmBooking}
                className="block w-full rounded-2xl bg-primary px-5 py-3.5 text-center font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {saving ? "جارٍ حفظ الحجز…" : "تأكيد الحجز"}
              </button>
            </div>
          )}
        </div>
      </div>
    </CustomerShell>
  );
}
