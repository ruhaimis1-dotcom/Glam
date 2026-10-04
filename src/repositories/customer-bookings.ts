import type { SupabaseClient } from "@supabase/supabase-js";
import { bookingDate, bookingTime } from "../lib/booking-time.ts";

export interface CustomerBooking {
  id: string;
  salon: string;
  service: string;
  date: string;
  time: string;
  status: string;
}
export type CustomerBookingsState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "error" }
  | { status: "ready"; bookings: CustomerBooking[] };

interface ReservationRow {
  id: string;
  status: string;
  glam_appointments: { salon_name: string; service_name: string; starts_at: string } | null;
}
const labels: Record<string, string> = {
  confirmed: "مؤكد",
  pending: "بانتظار التأكيد",
  cancelled: "ملغي",
  completed: "مكتمل",
};

export function startCustomerBookingsLoad(
  client: SupabaseClient,
  publish: (state: CustomerBookingsState) => void,
) {
  let active = true;
  let generation = 0;
  async function load(ticket: number) {
    const current = () => active && ticket === generation;
    try {
      const {
        data: { user },
        error: authError,
      } = await client.auth.getUser();
      if (!current()) return;
      if (authError) throw authError;
      if (!user) return publish({ status: "anonymous" });
      const { data, error } = await client
        .from("glam_reservations")
        .select("id,status,glam_appointments(salon_name,service_name,starts_at)")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });
      if (!current()) return;
      if (error || data === null) throw error ?? new Error("READ_NOT_CONFIRMED");
      const bookings = (data as unknown as ReservationRow[]).map((row) => ({
        id: row.id,
        salon: row.glam_appointments?.salon_name ?? "قلام",
        service: row.glam_appointments?.service_name ?? "خدمة",
        date: row.glam_appointments?.starts_at ? bookingDate(row.glam_appointments.starts_at) : "",
        time: row.glam_appointments?.starts_at ? bookingTime(row.glam_appointments.starts_at) : "",
        status: labels[row.status] ?? "حالة غير متاحة",
      }));
      publish({ status: "ready", bookings });
    } catch {
      if (current()) publish({ status: "error" });
    }
  }
  function refresh() {
    if (!active) return;
    const ticket = ++generation;
    publish({ status: "loading" });
    // Keep Supabase calls outside the synchronous Auth callback.
    void Promise.resolve().then(() => (active && ticket === generation ? load(ticket) : undefined));
  }
  const {
    data: { subscription },
  } = client.auth.onAuthStateChange(refresh);
  refresh();
  return () => {
    active = false;
    generation++;
    subscription.unsubscribe();
  };
}
