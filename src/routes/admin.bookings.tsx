/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase rows are runtime-shaped until generated types are added. */
import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminShell, PageHeader } from "@/components/glam/shells";
import { supabase } from "@/lib/supabase";
export const Route = createFileRoute("/admin/bookings")({ component: AdminBookingsPage });
function AdminBookingsPage() {
  const fallback = [
    "GS-1081 · لوميير ستوديو · اليوم 5:30 م",
    "GS-1080 · نيل بار الرياض · اليوم 7:00 م",
    "GS-1079 · سكينة سبا · غداً 2:00 م",
  ];
  const [rows, setRows] = useState<any[]>(
    fallback.map((label) => ({ label, attendance: "pending" })),
  );
  useEffect(() => {
    supabase
      .from("glam_reservations")
      .select("id,status,attendance,created_at")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data?.length)
          setRows(
            data.map((r: any, i) => ({
              id: r.id,
              label: `${r.id?.slice(0, 8) ?? `GS-${i}`} · حجز عميلة`,
              attendance: r.attendance ?? "pending",
            })),
          );
      });
  }, []);
  const update = async (row: any) => {
    if (!row.id) return;
    const attendance = row.attendance === "completed" ? "pending" : "completed";
    const { error } = await supabase
      .from("glam_reservations")
      .update({ attendance })
      .eq("id", row.id);
    if (!error) setRows(rows.map((r) => (r === row ? { ...r, attendance } : r)));
  };
  return (
    <AdminShell>
      <PageHeader title="الحجوزات" desc="سجل الحجوزات في المنصة" />
      <div className="glam-card divide-y">
        {rows.map((x: any) => (
          <div className="flex items-center gap-3 p-4" key={x.id ?? x.label}>
            <CalendarCheck className="size-5 text-primary" />
            <span>{x.label}</span>
            <button
              onClick={() => update(x)}
              className="mr-auto rounded-full bg-success/10 px-2 py-1 text-xs text-success"
            >
              {x.attendance === "completed" ? "مكتمل" : "مؤكد"}
            </button>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
