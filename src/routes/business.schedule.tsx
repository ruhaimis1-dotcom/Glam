/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase rows are runtime-shaped until generated types are added. */
import { createFileRoute } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { BusinessShell, PageHeader } from "@/components/glam/shells";
import { supabase } from "@/lib/supabase";
import { bookingTime, bookingDateKey } from "@/lib/booking-time";
import { useBusinessOrganization } from "@/lib/business-context";
export const Route = createFileRoute("/business/schedule")({ component: SchedulePage });
function SchedulePage() {
  const { id: organizationId, name: organizationName } = useBusinessOrganization();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!organizationId) return;
      const day = bookingDateKey(new Date());
      const dayStart = new Date(`${day}T00:00:00+03:00`);
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const { data } = await supabase
        .from("glam_appointments")
        .select(
          "id,starts_at,ends_at,service_name,specialist_name,buffer_minutes,service_variant_id",
        )
        .eq("organization_id", organizationId)
        .gte("starts_at", dayStart.toISOString())
        .lt("starts_at", dayEnd.toISOString())
        .order("starts_at");
      if (cancelled) return;
      if (!data?.length) {
        setRows([]);
        return;
      }
      const ids = data.map((a) => a.id);
      const { data: reservations } = await supabase
        .from("glam_reservations")
        .select("id,appointment_id,attendance")
        .in("appointment_id", ids)
        .eq("status", "confirmed");
      const reservationByAppointment = new Map(
        (reservations ?? []).map((r) => [r.appointment_id, r]),
      );
      if (cancelled) return;
      setRows(
        data.map((a) => ({
          id: a.id,
          reservationId: reservationByAppointment.get(a.id)?.id,
          label: `${bookingTime(a.starts_at)}${a.ends_at ? `–${bookingTime(a.ends_at)}` : ""} — ${a.service_name}${a.specialist_name ? ` — ${a.specialist_name}` : ""}${a.buffer_minutes ? ` · تجهيز ${a.buffer_minutes} د` : ""}`,
          attendance: reservationByAppointment.get(a.id)?.attendance ?? "pending",
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);
  const update = async (row: any) => {
    if (!row.id) return;
    if (!row.reservationId) return;
    const attendance = row.attendance === "completed" ? "pending" : "completed";
    const { error } = await supabase
      .from("glam_reservations")
      .update({ attendance })
      .eq("id", row.reservationId);
    if (!error) setRows(rows.map((r) => (r === row ? { ...r, attendance } : r)));
  };
  return (
    <BusinessShell>
      <PageHeader title="جدول اليوم" desc={`المواعيد المجدولة في ${organizationName}`} />
      <div className="glam-card divide-y">
        {rows.length === 0 && (
          <p className="p-4 text-muted-foreground">لا توجد مواعيد لليوم بتوقيت الرياض.</p>
        )}
        {rows.map((x: any) => (
          <div className="flex items-center gap-3 p-4" key={x.id ?? x.label}>
            <Clock className="size-4 text-primary" />
            <span>{x.label}</span>
            <button
              onClick={() => update(x)}
              className="mr-auto rounded-full bg-success/10 px-2 py-1 text-xs text-success"
            >
              {!x.reservationId ? "بدون حجز" : x.attendance === "completed" ? "مكتمل" : "مؤكد"}
            </button>
          </div>
        ))}
      </div>
    </BusinessShell>
  );
}
