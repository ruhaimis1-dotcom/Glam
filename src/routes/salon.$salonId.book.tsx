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
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
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
          setDate(first.starts_at.slice(0, 10));
          setTime("");
          setAppointmentId(null);
        }
      });
  }, [salon?.name]);
  const services = [...new Set(appointments.map((a) => a.service_name))];
  const serviceAppointments = appointments.filter((a) => a.service_name === service);
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
      const { error: insertError } = await supabase.from("glam_reservations").insert({
        id: crypto.randomUUID(),
        appointment_id: appointmentId,
        customer_id: user.id,
        request_id: crypto.randomUUID(),
        status: "confirmed",
        attendance: "pending",
        booking_source: "salon_link",
      });
      if (insertError) throw insertError;
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
      setError(code === "AUTH_REQUIRED" ? "يجب تسجيل الدخول لإتمام الحجز." : code === "ALREADY_BOOKED" ? "هذا الموعد محجوز مسبقًا." : "تعذر حفظ الحجز حاليًا. يرجى المحاولة مرة أخرى.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <CustomerShell title="تأكيد الحجز" back={`/salon/${salonId}`}>
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
            الخدمة
            <select
              value={service}
              onChange={(e) => {
                const next = e.target.value;
                setService(next);
                const first = appointments.find((a) => a.service_name === next);
                setDate(first?.starts_at.slice(0, 10) ?? "");
                setTime("");
                setAppointmentId(null);
              }}
              className="mt-2 w-full rounded-xl border bg-background px-4 py-3"
            >
              {services.length === 0 && <option value="">لا توجد خدمات متاحة</option>}
              {services.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
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
              {availableDates.length === 0 && <option value="">لا توجد أيام متاحة</option>}
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
              {service} في {salon.name}
            </p>
            <p className="mt-1 text-muted-foreground">
              السعر التقديري يبدأ من {formatSAR(salon.priceFrom)}
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
