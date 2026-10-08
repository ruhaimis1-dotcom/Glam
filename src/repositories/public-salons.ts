import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const publicAppointmentSchema = z.object({
  organization_id: z.string().uuid(),
  salon_name: z.string().trim().min(1),
  service_name: z.string().trim().min(1),
  starts_at: z.string().datetime({ offset: true }),
});

export type PublicSalonSummary = {
  organizationId: string;
  name: string;
  nextStartsAt: string;
  services: string[];
};

export async function loadPublicSalons(client: SupabaseClient): Promise<PublicSalonSummary[]> {
  const { data, error } = await client
    .from("glam_appointments")
    .select("organization_id,salon_name,service_name,starts_at")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at")
    .limit(200);
  if (error) throw error;

  const appointments = z.array(publicAppointmentSchema).parse(data);
  const salons = new Map<string, PublicSalonSummary>();
  for (const appointment of appointments) {
    const current = salons.get(appointment.organization_id);
    if (!current) {
      salons.set(appointment.organization_id, {
        organizationId: appointment.organization_id,
        name: appointment.salon_name,
        nextStartsAt: appointment.starts_at,
        services: [appointment.service_name],
      });
      continue;
    }
    if (current.name !== appointment.salon_name) throw new Error("SALON_IDENTITY_CONFLICT");
    if (!current.services.includes(appointment.service_name))
      current.services.push(appointment.service_name);
  }
  return [...salons.values()];
}
