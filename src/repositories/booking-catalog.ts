import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const appointmentSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  salon_name: z.string().trim().min(1),
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
  glam_service_delivery_options: z.array(
    z.object({
      channel: z.enum(["salon", "home"]),
      enabled: z.boolean(),
      price_sar: z.number().nullable(),
      minutes: z.number().nullable(),
      travel_fee_sar: z.number(),
    }),
  ),
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
  channels: Array<"salon" | "home">;
  variants: Array<{ id: string; name: string; price: number; minutes: number }>;
};
export type BookingCatalog = {
  organizationId: string;
  salonName: string;
  appointments: BookingAppointment[];
  catalog: BookingService[];
};
export type BookingCatalogState =
  { status: "loading" } | { status: "error" } | { status: "ready"; data: BookingCatalog };

export function startBookingCatalogLoad(
  client: SupabaseClient,
  organizationId: string,
  publish: (state: BookingCatalogState) => void,
): () => void {
  let cancelled = false;
  publish({ status: "loading" });
  void loadBookingCatalog(client, organizationId).then(
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

export async function loadBookingCatalog(
  client: SupabaseClient,
  organizationId: string,
): Promise<BookingCatalog> {
  if (!z.string().uuid().safeParse(organizationId).success) throw new Error("INVALID_ORGANIZATION");

  const appointmentsResult = await client
    .from("glam_appointments")
    .select("id,organization_id,salon_name,service_id,service_variant_id,service_name,starts_at")
    .eq("organization_id", organizationId)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at");
  if (appointmentsResult.error) throw appointmentsResult.error;
  const appointments = z.array(appointmentSchema).parse(appointmentsResult.data);
  if (appointments.some((row) => row.organization_id !== organizationId))
    throw new Error("CROSS_ORGANIZATION_APPOINTMENT");

  const salonNames = [...new Set(appointments.map((row) => row.salon_name))];
  if (salonNames.length > 1) throw new Error("SALON_IDENTITY_CONFLICT");
  const salonName = salonNames[0] ?? "";

  const ids = [...new Set(appointments.flatMap((row) => (row.service_id ? [row.service_id] : [])))];
  if (!ids.length) return { organizationId, salonName, appointments: [], catalog: [] };

  const servicesResult = await client
    .from("glam_services")
    .select(
      "id,name,price_sar,minutes,active,category_id,glam_service_categories!glam_services_category_id_fkey(name),glam_service_variants!glam_service_variants_service_id_fkey(id,name,price_sar,minutes,active),glam_service_delivery_options!glam_service_delivery_options_service_id_fkey(channel,enabled,price_sar,minutes,travel_fee_sar)",
    )
    .eq("organization_id", organizationId)
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
        channels: row.glam_service_delivery_options
          .filter(
            (d) =>
              d.enabled &&
              d.travel_fee_sar === 0 &&
              (d.price_sar === null || d.price_sar === row.price_sar) &&
              (d.minutes === null || d.minutes === row.minutes),
          )
          .map((d) => d.channel),
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
    organizationId,
    salonName,
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
