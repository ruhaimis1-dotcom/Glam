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
  salon_name: string | null;
  service_name: string | null;
  starts_at: string | null;
};

function AdminBookingsPage() {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    void supabase.rpc("glam_admin_bookings").then(({ data, error }) => {
      if (!active) return;
      if (error || data === null) {
        setStatus("error");
        return;
      }
      setRows(data as BookingRow[]);
      setStatus("ready");
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AdminShell>
      <PageHeader title="الحجوزات" desc="سجل الحجوزات الفعلي في المنصة" />
      {status === "loading" && <p role="status">جارٍ تحميل الحجوزات…</p>}
      {status === "error" && (
        <p role="alert" className="glam-card p-5">
          تعذر تحميل الحجوزات بصلاحيات الإدارة الحالية.
        </p>
      )}
      {status === "ready" && !rows.length && (
        <p className="glam-card p-5 text-muted-foreground">لا توجد حجوزات متاحة للعرض.</p>
      )}
      <div className="glam-card divide-y">
        {rows.map((row) => (
          <div className="flex flex-wrap items-center gap-3 p-4" key={row.id}>
            <CalendarCheck className="size-5 text-primary" />
            <div className="min-w-0 flex-1">
              <p>
                {row.salon_name ?? "صالون"} · {row.service_name ?? "خدمة"} ·{" "}
                {row.starts_at ? new Date(row.starts_at).toLocaleString("ar-SA") : "موعد"}
              </p>
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
