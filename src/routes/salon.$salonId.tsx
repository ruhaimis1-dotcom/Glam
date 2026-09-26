/* eslint-disable @typescript-eslint/no-explicit-any -- legacy booking payloads are read from local storage. */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, MapPin, ShieldCheck } from "lucide-react";
import { byId, formatSAR } from "@/data/mock";
import { CustomerShell } from "@/components/glam/shells";
import { PrivacyBadges, SalonCover, Stars } from "@/components/glam/ui";
import { readStored, writeStored } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

function categoryForService(name: string) {
  if (/بالياج|قص|تصفيف|صبغ/.test(name)) return "الشعر";
  if (/مكياج/.test(name)) return "المكياج";
  if (/بشرة|هيدرا/.test(name)) return "العناية بالبشرة";
  if (/أظافر|مناكير|بديكير/.test(name)) return "الأظافر";
  return "خدمات أخرى";
}

export const Route = createFileRoute("/salon/$salonId")({ component: SalonPage });

function SalonPage() {
  const { salonId } = Route.useParams();
  const salon = byId.salon(salonId);
  const [service, setService] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
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
        setService("");
        setCategory("");
        setDate("");
        setTime("");
        setAppointmentId(null);
      });
  }, [salon?.name]);
  const services = [...new Set(appointments.map((a) => a.service_name))];
  const categories = [...new Set(services.map(categoryForService))];
  const categoryServices = services.filter((name) => categoryForService(name) === category);
  const serviceAppointments = appointments.filter((a) => a.service_name === service);
  const availableDates = [...new Set(serviceAppointments.map((a) => a.starts_at.slice(0, 10)))];
  const dateAppointments = serviceAppointments.filter((a) => a.starts_at.slice(0, 10) === date);
  const confirmBooking = async () => {
    setBookingError("");
    if (!service) {
      setBookingError("يرجى اختيار الخدمة أولاً.");
      return;
    }
    if (!date) {
      setBookingError("يرجى اختيار اليوم أولاً.");
      return;
    }
    if (!appointmentId) {
      setBookingError("يرجى اختيار الوقت المتاح قبل تأكيد الحجز.");
      return;
    }
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("AUTH_REQUIRED");
      const { data: existing } = await supabase
        .from("glam_reservations")
        .select("id")
        .eq("appointment_id", appointmentId)
        .eq("customer_id", user.id)
        .eq("status", "confirmed")
        .maybeSingle();
      if (existing) throw new Error("ALREADY_BOOKED");
      const { data: appointmentReservation } = await supabase
        .from("glam_reservations")
        .select("id,status")
        .eq("appointment_id", appointmentId)
        .in("status", ["confirmed", "pending"])
        .maybeSingle();
      if (appointmentReservation) throw new Error("APPOINTMENT_UNAVAILABLE");
      const { data: createdReservation, error } = await supabase
        .from("glam_reservations")
        .insert({
          id: crypto.randomUUID(),
          appointment_id: appointmentId,
          customer_id: user.id,
          request_id: crypto.randomUUID(),
          status: "confirmed",
          attendance: "pending",
          booking_source: "salon_link",
        })
        .select("id,customer_id,appointment_id,status")
        .single();
      if (error) throw error;
      if (!createdReservation || createdReservation.customer_id !== user.id) {
        throw new Error("BOOKING_NOT_PERSISTED");
      }
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
    } catch (error) {
      console.error("booking_insert_failed", error);
      const code = error instanceof Error ? error.message : "BOOKING_INSERT_FAILED";
      const unavailable =
        code === "APPOINTMENT_UNAVAILABLE" || code.includes("23505") || code.includes("duplicate");
      setBookingError(
        code === "AUTH_REQUIRED"
          ? "يجب تسجيل الدخول لإتمام الحجز."
          : code === "ALREADY_BOOKED" || unavailable
            ? "هذا الموعد لم يعد متاحًا. اختاري وقتًا آخر."
            : "تعذر حفظ الحجز حاليًا. يرجى المحاولة مرة أخرى.",
      );
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
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setService("");
                  setDate("");
                  setTime("");
                  setAppointmentId(null);
                }}
                className="w-full rounded-xl border bg-background px-4 py-3"
              >
                <option value="">اختاري التصنيف</option>
                {categories.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={service}
                onChange={(e) => {
                  setService(e.target.value);
                  setDate("");
                  setTime("");
                  setAppointmentId(null);
                }}
                className="w-full rounded-xl border bg-background px-4 py-3"
              >
                <option value="">اختاري الخدمة</option>
                {categoryServices.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              {/* The original service selector is replaced by the category-filtered selector above. */}
              <select
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setTime("");
                  setAppointmentId(null);
                }}
                className="w-full rounded-xl border bg-background px-4 py-3"
              >
                <option value="">اختاري اليوم</option>
                {availableDates.length === 0 && (
                  <option value="" disabled>
                    لا توجد أيام متاحة
                  </option>
                )}
                {availableDates.map((availableDate) => (
                  <option key={availableDate} value={availableDate}>
                    {new Date(`${availableDate}T00:00:00`).toLocaleDateString("ar-SA", {
                      dateStyle: "medium",
                    })}
                  </option>
                ))}
              </select>
              <select
                value={appointmentId ?? ""}
                onChange={(e) => {
                  const selected = dateAppointments.find((a) => a.id === e.target.value);
                  setAppointmentId(selected?.id ?? null);
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
                <option value="">اختاري الوقت</option>
                {dateAppointments.map((appointment) => (
                  <option key={appointment.id} value={appointment.id}>
                    {new Date(appointment.starts_at).toLocaleTimeString("ar-SA", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </option>
                ))}
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
