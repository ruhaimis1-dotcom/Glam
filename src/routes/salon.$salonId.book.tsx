/* eslint-disable @typescript-eslint/no-explicit-any -- legacy booking payloads are read from local storage. */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, CheckCircle2 } from "lucide-react";
import { CustomerShell } from "@/components/glam/shells";
import { byId, formatSAR } from "@/data/mock";
import { readStored, writeStored } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/salon/$salonId/book")({ component: BookSalonPage });
function BookSalonPage() {
  const { salonId } = Route.useParams();
  const salon = byId.salon(salonId);
  const navigate = useNavigate();
  const [service, setService] = useState("");
  const [variantId, setVariantId] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<
    Array<{ id: string; service_id: string | null; service_variant_id: string | null; service_name: string; starts_at: string }>
  >([]);
  const [catalog, setCatalog] = useState<Array<{ id: string; name: string; categoryName: string; price: number; minutes: number; variants: Array<{ id: string; name: string; price: number; minutes: number }> }>>([]);
  useEffect(() => {
    supabase
      .from("glam_appointments")
      .select("id,service_id,service_variant_id,service_name,starts_at")
      .eq("salon_name", salon?.name ?? "")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .then(({ data }) => {
        const rows = (data ?? []) as Array<{ id: string; service_id: string | null; service_variant_id: string | null; service_name: string; starts_at: string }>;
        setAppointments(rows);
        const ids = [...new Set(rows.map((row) => row.service_id).filter(Boolean))] as string[];
        if (ids.length) supabase.from("glam_services").select("id,name,price_sar,minutes,glam_service_categories(name),glam_service_variants(id,name,price_sar,minutes,active)").in("id", ids).eq("active", true).then(({ data: rows2 }) => setCatalog((rows2 ?? []).map((row: any) => ({ id: row.id, name: row.name, categoryName: row.glam_service_categories?.name ?? "خدمات أخرى", price: Number(row.price_sar), minutes: Number(row.minutes), variants: (row.glam_service_variants ?? []).filter((v: any) => v.active).map((v: any) => ({ id: v.id, name: v.name, price: Number(v.price_sar), minutes: Number(v.minutes) })) }))));
        else setCatalog([]);
        setService("");
        setVariantId("");
        setCategory("");
        setDate("");
        setTime("");
        setAppointmentId(null);
      });
  }, [salon?.name]);
  const fallback = [...new Set(appointments.map((a) => a.service_name))].map((name) => ({ id: name, name, categoryName: "خدمات أخرى", price: salon?.priceFrom ?? 0, minutes: 60, variants: [] as Array<{ id: string; name: string; price: number; minutes: number }> }));
  const serviceOptions = catalog.length ? catalog : fallback;
  const categories = [...new Set(serviceOptions.map((item) => item.categoryName))];
  const categoryServices = serviceOptions.filter((item) => item.categoryName === category);
  const selectedService = serviceOptions.find((item) => item.id === service);
  const selectedVariant = selectedService?.variants.find((item) => item.id === variantId);
  const serviceAppointments = appointments.filter((a) => (a.service_id ? a.service_id === service : a.service_name === selectedService?.name) && (!variantId || a.service_variant_id === variantId));
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
    if (!service) {
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
    if (!appointmentId) {
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
      const unavailable = code === "APPOINTMENT_UNAVAILABLE" || code.includes("23505") || code.includes("duplicate");
      setError(code === "AUTH_REQUIRED" ? "يجب تسجيل الدخول لإتمام الحجز." : code === "ALREADY_BOOKED" || unavailable ? "هذا الموعد لم يعد متاحًا. اختاري وقتًا آخر." : "تعذر حفظ الحجز حاليًا. يرجى المحاولة مرة أخرى.");
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
              {categories.map((name) => <option key={name} value={name}>{name}</option>)}
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
                  <option key={item.id} value={item.id}>{item.name} · {item.price} ر.س · {item.minutes} دقيقة</option>
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
              {availableDates.length === 0 && <option value="" disabled>لا توجد أيام متاحة</option>}
              {availableDates.map((availableDate) => (
                <option key={availableDate} value={availableDate}>
                  {new Date(`${availableDate}T00:00:00`).toLocaleDateString("ar-SA", { dateStyle: "medium" })}
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
                setTime(selected ? new Date(selected.starts_at).toLocaleTimeString("ar-SA", { hour: "numeric", minute: "2-digit" }) : "");
              }}
              className="mt-2 w-full rounded-xl border bg-background px-4 py-3"
            >
              <option value="">اختاري الوقت</option>
              {dateAppointments.map((appointment) => (
                <option key={appointment.id} value={appointment.id}>
                  {new Date(appointment.starts_at).toLocaleTimeString("ar-SA", { hour: "numeric", minute: "2-digit" })}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-xl bg-muted/50 p-4 text-sm">
            <CalendarDays className="mb-2 size-5 text-primary" />
            <p>
              {selectedService?.name ?? service} {selectedVariant ? `· ${selectedVariant.name}` : ""} في {salon.name}
            </p>
            <p className="mt-1 text-muted-foreground">
              السعر {selectedVariant ? formatSAR(selectedVariant.price) : selectedService ? formatSAR(selectedService.price) : `يبدأ من ${formatSAR(salon.priceFrom)}`} · المدة {selectedVariant?.minutes ?? selectedService?.minutes ?? 60} دقيقة
            </p>
          </div>
          {error && (
            <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
          )}
          <button
            disabled={saving}
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
