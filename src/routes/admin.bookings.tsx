import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminShell, PageHeader } from "@/components/glam/shells";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/bookings")({ component: AdminBookingsPage });

type BookingRow = {
  id: string;
  status: string;
  created_at: string;
  appointment_id: string;
  delivery_channel: string | null;
  label: string;
};

function AdminBookingsPage() {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: reservations, error } = await supabase
        .from("glam_reservations")
        .select("id,status,created_at,appointment_id,delivery_channel")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!active) return;
      if (error) {
        setStatus("error");
        return;
      }

      const appointmentIds = (reservations ?? []).map((row) => row.appointment_id);
      const { data: appointments } = appointmentIds.length
        ? await supabase
            .from("glam_appointments")
            .select("id,salon_name,service_name,starts_at")
            .in("id", appointmentIds)
        : { data: [] as Array<Record<string, unknown>> };

      const appointmentMap = new Map((appointments ?? []).map((row) => [row.id, row]));
      setRows(
        (reservations ?? []).map((row) => {
          const appointment = appointmentMap.get(row.appointment_id) as
            | { salon_name?: string; service_name?: string; starts_at?: string }
            | undefined;
          return {
            ...row,
            label: appointment
              ? `${appointment.salon_name ?? "صالون"} · ${appointment.service_name ?? "خدمة"} · ${appointment.starts_at ? new Date(appointment.starts_at).toLocaleString("ar-SA") : "موعد"}`
              : `حجز ${row.id.slice(0, 8)}`,
          };
        }),
      );
      setStatus("ready");
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <AdminShell>
      <PageHeader title="الحجوزات" desc="سجل الحجوزات الفعلي في المنصة" />
      {status === "loading" && <p role="status">جارٍ تحميل الحجوزات…</p>}
      {status === "error" && (
        <p role="alert" className="glam-card p-5">تعذر تحميل الحجوزات بصلاحيات الإدارة الحالية.</p>
      )}
      {status === "ready" && !rows.length && (
        <p className="glam-card p-5 text-muted-foreground">لا توجد حجوزات متاحة للعرض.</p>
      )}
      <div className="glam-card divide-y">
        {rows.map((row) => (
          <div className="flex flex-wrap items-center gap-3 p-4" key={row.id}>
            <CalendarCheck className="size-5 text-primary" />
            <div className="min-w-0 flex-1">
              <p>{row.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {row.delivery_channel === "home"
                  ? "خدمة منزلية"
                  : row.delivery_channel === "salon"
                    ? "داخل الصالون"
                    : "قناة التقديم غير محددة"}
              </p>
            </div>
            <span className="rounded-full border px-2.5 py-1 text-xs">{row.status}</span>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
