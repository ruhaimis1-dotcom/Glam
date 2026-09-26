/* eslint-disable @typescript-eslint/no-explicit-any -- legacy booking payloads are read from local storage. */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, CheckCircle2 } from "lucide-react";
import { CustomerShell } from "@/components/glam/shells";
import { byId, formatSAR } from "@/data/mock";
import { readStored, writeStored } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { startBookingCatalogLoad, type BookingCatalogState } from "@/repositories/booking-catalog";

export const Route = createFileRoute("/salon/$salonId/book")({ component: BookSalonPage });
function BookSalonPage() {
  const { salonId } = Route.useParams();
  return <BookingForm key={salonId} salonId={salonId} />;
}

function BookingForm({ salonId }: { salonId: string }) {
  const salon = byId.salon(salonId);
  const [service, setService] = useState("");
  const [variantId, setVariantId] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [catalogState, setCatalogState] = useState<BookingCatalogState>({ status: "loading" });
  const catalogStatus = catalogState.status;
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setService("");
    setVariantId("");
    setCategory("");
    setDate("");
    setTime("");
    setAppointmentId(null);
    setError("");
    setDone(false);
    return startBookingCatalogLoad(supabase, salon?.name ?? "", setCatalogState);
  }, [salon?.name, attempt]);
  const { appointments, catalog: serviceOptions } =
    catalogState.status === "ready" ? catalogState.data : { appointments: [], catalog: [] };
  const categories = [...new Set(serviceOptions.map((item) => item.categoryName))];
  const categoryServices = serviceOptions.filter((item) => item.categoryName === category);
  const selectedService = serviceOptions.find((item) => item.id === service);
  const selectedVariant = selectedService?.variants.find((item) => item.id === variantId);
  const serviceAppointments = appointments.filter(
    (a) => a.service_id === service && (!variantId || a.service_variant_id === variantId),
  );
  const availableDates = [...new Set(serviceAppointments.map((a) => a.starts_at.slice(0, 10)))];
  const dateAppointments = serviceAppointments.filter((a) => a.starts_at.slice(0, 10) === date);
  if (!salon)
    return (
      <CustomerShell title="الحجز" back="/">
        <div className="glam-card p-8 text-center">الصالون غير موجود</div>
      </CustomerShell>
    );
  const confirm = async () => {
    setError("");
    if (catalogStatus !== "ready" || !selectedService) {
      setError("يرجى اختيار الخدمة أولاً.");
      return;
    }
    if (selectedService?.variants.length && !variantId) {
      setError("يرجى اختيار خيار الخدمة والمدة أولاً.");
      return;
    }
    if (!date) {
      setError("يرجى اختيار اليوم أولاً.");
      return;
    }
    if (!appointmentId || !dateAppointments.some((a) => a.id === appointmentId)) {
      setError("يرجى اختيار الوقت المتاح قبل تأكيد الحجز.");
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
      const { data: createdReservation, error: insertError } = await supabase
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
      if (insertError) throw insertError;
      if (!createdReservation || createdReservation.customer_id !== user.id) {
        throw new Error("BOOKING_NOT_PERSISTED");
      }
      const bookings = readStored<any[]>("glam-bookings", []);
      bookings.unshift({
        id: `GL-${Date.now().toString().slice(-6)}`,
        customer_id: user.id,
        salonId,
        salon: salon.name,
        service,
        date,
        time,
        status: "مؤكد",
      });
      writeStored("glam-bookings", bookings);
      window.dispatchEvent(new Event("glam-bookings-updated"));
      setDone(true);
    } catch (e) {
      console.error("booking_insert_failed", e);
      const code = e instanceof Error ? e.message : "BOOKING_INSERT_FAILED";
      const unavailable =
        code === "APPOINTMENT_UNAVAILABLE" || code.includes("23505") || code.includes("duplicate");
      setError(
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
  return (
    <CustomerShell title="تأكيد الحجز" back="/">
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/salon/$salonId"
          params={{ salonId }}
          className="grid size-9 place-items-center rounded-full border bg-card"
        >
          <ArrowRight className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">احجزي في {salon.name}</h1>
          <p className="text-sm text-muted-foreground">اختاري خدمة وموعدًا متاحًا فعليًا</p>
        </div>
      </div>
      {done ? (
        <section className="glam-card space-y-4 p-7 text-center">
          <CheckCircle2 className="mx-auto size-12 text-success" />
          <h2 className="text-xl font-bold">تم تأكيد الحجز</h2>
          <p className="text-sm text-muted-foreground">
            {service} · {date} · {time}
          </p>
          <Link
            to="/bookings"
            className="inline-flex rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground"
          >
            عرض حجوزاتي
          </Link>
        </section>
      ) : catalogStatus === "loading" ? (
        <p role="status" className="glam-card p-5">
          جارٍ تحميل الخدمات والمواعيد…
        </p>
      ) : catalogStatus === "error" ? (
        <section className="glam-card space-y-4 p-5">
          <p role="alert">تعذر تحميل الخدمات والمواعيد. لا يمكن تأكيد الحجز قبل اكتمال التحميل.</p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className="rounded-full border px-5 py-2.5"
          >
            إعادة المحاولة
          </button>
        </section>
      ) : serviceOptions.length === 0 ? (
        <p role="status" className="glam-card p-5">
          لا توجد خدمات متاحة للحجز حاليًا.
        </p>
      ) : (
        <section className="glam-card space-y-5 p-5">
          <label className="block text-sm font-medium">
            التصنيف الرئيسي
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setService("");
                setVariantId("");
                setDate("");
                setTime("");
                setAppointmentId(null);
              }}
              className="mt-2 w-full rounded-xl border bg-background px-4 py-3"
            >
              <option value="">اختاري التصنيف</option>
              {categories.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            الخدمة
            <select
              value={service}
              onChange={(e) => {
                const next = e.target.value;
                setService(next);
                setVariantId("");
                setDate("");
                setTime("");
                setAppointmentId(null);
              }}
              className="mt-2 w-full rounded-xl border bg-background px-4 py-3"
            >
              <option value="">اختاري الخدمة</option>
              {categoryServices.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {selectedService?.variants.length ? (
            <label className="block text-sm font-medium">
              خيار الخدمة والمدة
              <select
                value={variantId}
                onChange={(e) => {
                  setVariantId(e.target.value);
                  setDate("");
                  setTime("");
                  setAppointmentId(null);
                }}
                className="mt-2 w-full rounded-xl border bg-background px-4 py-3"
              >
                <option value="">اختاري الخيار</option>
                {selectedService.variants.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.price} ر.س · {item.minutes} دقيقة
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block text-sm font-medium">
            الموعد
            <select
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setTime("");
                setAppointmentId(null);
              }}
              className="mt-2 w-full rounded-xl border bg-background px-4 py-3"
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
          </label>
          <label className="block text-sm font-medium">
            الوقت
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
              className="mt-2 w-full rounded-xl border bg-background px-4 py-3"
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
          </label>
          {selectedService && (
            <div className="rounded-xl bg-muted/50 p-4 text-sm">
              <CalendarDays className="mb-2 size-5 text-primary" />
              <p>
                {selectedService.name} {selectedVariant?.name} في {salon.name}
              </p>
              {(!selectedService.variants.length || selectedVariant) && (
                <p className="mt-1 text-muted-foreground">
                  السعر {formatSAR((selectedVariant ?? selectedService).price)} · المدة{" "}
                  {(selectedVariant ?? selectedService).minutes} دقيقة
                </p>
              )}
            </div>
          )}
          {error && (
            <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
          )}
          <button
            disabled={saving || !selectedService || !appointmentId}
            onClick={confirm}
            className="w-full rounded-2xl bg-primary px-5 py-3.5 font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving ? "جارٍ تأكيد الحجز…" : "تأكيد الحجز"}
          </button>
        </section>
      )}
    </CustomerShell>
  );
}
