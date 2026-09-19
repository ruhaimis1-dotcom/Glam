/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase rows are runtime-shaped until generated types are added. */
import { createFileRoute } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { BusinessShell, PageHeader } from "@/components/glam/shells";
import { supabase } from "@/lib/supabase";
import { getCurrentOrganization } from "@/lib/glam-org";
export const Route = createFileRoute("/business/schedule")({ component: SchedulePage });
function SchedulePage() {
  const fallback = [
    "10:00 ص — هند ع. — بالاياج كامل",
    "1:00 م — ريم س. — قص وتصفيف",
    "4:00 م — بدور ق. — مكياج سهرة",
    "8:00 م — لمى ح. — تسريحة مناسبة",
  ];
  const [rows, setRows] = useState<any[]>(
    fallback.map((label) => ({ label, attendance: "pending" })),
  );
  useEffect(() => {
    getCurrentOrganization().then(async ({ organizationId }) => {
      if (!organizationId) return;
      const { data } = await supabase
        .from("glam_appointments")
        .select("id,starts_at,service_name,specialist_name")
        .eq("organization_id", organizationId)
        .order("starts_at");
      if (!data?.length) return;
      const ids = data.map((a) => a.id);
      const { data: reservations } = await supabase
        .from("glam_reservations")
        .select("id,appointment_id,attendance")
        .in("appointment_id", ids);
      const reservationByAppointment = new Map(
        (reservations ?? []).map((r) => [r.appointment_id, r]),
      );
      setRows(
        data.map((a) => ({
          id: a.id,
          reservationId: reservationByAppointment.get(a.id)?.id,
          label: `${new Date(a.starts_at).toLocaleTimeString("ar-SA", { hour: "numeric", minute: "2-digit" })} — ${a.service_name}${a.specialist_name ? ` — ${a.specialist_name}` : ""}`,
          attendance: reservationByAppointment.get(a.id)?.attendance ?? "pending",
        })),
      );
    });
  }, []);
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
      <PageHeader title="جدول اليوم" desc="المواعيد المجدولة في لوميير ستوديو" />
      <div className="glam-card divide-y">
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
