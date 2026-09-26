import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const appointmentSchema = z.object({
  id: z.string().uuid(),
  service_id: z.string().uuid().nullable(),
  service_variant_id: z.string().uuid().nullable(),
  service_name: z.string(),
  starts_at: z.string().datetime({ offset: true }),
});
const optionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1),
  price_sar: z.number().finite().min(0).max(10000),
  minutes: z.number().int().min(15).max(480).multipleOf(15),
  active: z.boolean(),
});
const serviceSchema = optionSchema.extend({
  category_id: z.string().uuid().nullable(),
  glam_service_categories: z.object({ name: z.string().min(1) }).nullable(),
  glam_service_variants: z.array(optionSchema),
});

export type BookingAppointment = z.infer<typeof appointmentSchema>;
export type BookingService = {
  id: string;
  name: string;
  categoryName: string;
  price: number;
  minutes: number;
  variants: Array<{ id: string; name: string; price: number; minutes: number }>;
};
export type BookingCatalog = { appointments: BookingAppointment[]; catalog: BookingService[] };
export type BookingCatalogState =
  { status: "loading" | "error" } | { status: "ready"; data: BookingCatalog };

// Cleanup prevents an older salon/retry request from publishing into a new view.
export function startBookingCatalogLoad(
  client: SupabaseClient,
  salonName: string,
  publish: (state: BookingCatalogState) => void,
): () => void {
  let cancelled = false;
  publish({ status: "loading" });
  void loadBookingCatalog(client, salonName).then(
    (data) => {
      if (!cancelled) publish({ status: "ready", data });
    },
    () => {
      if (!cancelled) publish({ status: "error" });
    },
  );
  return () => {
    cancelled = true;
  };
}

// Publish a complete result only. A failed or malformed read must never become
// a partial catalog or a price/identity inferred from an appointment.
export async function loadBookingCatalog(
  client: SupabaseClient,
  salonName: string,
): Promise<BookingCatalog> {
  const appointmentsResult = await client
    .from("glam_appointments")
    .select("id,service_id,service_variant_id,service_name,starts_at")
    .eq("salon_name", salonName)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at");
  if (appointmentsResult.error) throw appointmentsResult.error;
  const appointments = z.array(appointmentSchema).parse(appointmentsResult.data);
  const ids = [...new Set(appointments.flatMap((row) => (row.service_id ? [row.service_id] : [])))];
  if (!ids.length) return { appointments: [], catalog: [] };

  const servicesResult = await client
    .from("glam_services")
    .select(
      "id,name,price_sar,minutes,active,category_id,glam_service_categories!glam_services_category_id_fkey(name),glam_service_variants!glam_service_variants_service_id_fkey(id,name,price_sar,minutes,active)",
    )
    .in("id", ids)
    .eq("active", true);
  if (servicesResult.error) throw servicesResult.error;
  const services = z.array(serviceSchema).parse(servicesResult.data);
  const catalog = services
    .filter((row) => row.active && ids.includes(row.id))
    .map((row) => {
      if (row.category_id && !row.glam_service_categories) {
        throw new Error("CATALOG_CATEGORY_UNAVAILABLE");
      }
      return {
        id: row.id,
        name: row.name,
        categoryName: row.glam_service_categories?.name ?? "خدمات أخرى",
        price: row.price_sar,
        minutes: row.minutes,
        variants: row.glam_service_variants
          .filter((v) => v.active)
          .map((v) => ({
            id: v.id,
            name: v.name,
            price: v.price_sar,
            minutes: v.minutes,
          })),
      };
    });
  return {
    catalog,
    appointments: appointments.filter((appointment) =>
      catalog.some(
        (service) =>
          service.id === appointment.service_id &&
          (appointment.service_variant_id === null ||
            service.variants.some((v) => v.id === appointment.service_variant_id)),
      ),
    ),
  };
}
