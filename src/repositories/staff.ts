import type { SupabaseClient } from "@supabase/supabase-js";
import { requireBusinessOrganization } from "@/lib/business-access";

export type StaffMember = {
  id: string;
  organization_id: string;
  name: string;
  specialty: string;
  phone: string | null;
  active: boolean;
};

export async function listStaff(client: SupabaseClient, organizationId: string): Promise<StaffMember[]> {
  await requireBusinessOrganization(client, organizationId);
  const { data, error } = await client
    .from("glam_staff")
    .select("id,organization_id,name,specialty,phone,active")
    .eq("organization_id", organizationId)
    .order("active", { ascending: false })
    .order("name");
  if (error) throw error;
  return (data ?? []) as StaffMember[];
}

export async function createStaff(
  client: SupabaseClient,
  organizationId: string,
  input: { name: string; specialty: string; phone?: string },
) {
  await requireBusinessOrganization(client, organizationId);
  const name = input.name.trim();
  const specialty = input.specialty.trim();
  const phone = input.phone?.trim() || null;
  if (name.length < 2 || specialty.length < 2) throw new Error("INVALID_INPUT");
  const { data, error } = await client
    .from("glam_staff")
    .insert({ organization_id: organizationId, name, specialty, phone })
    .select("id,organization_id,name,specialty,phone,active")
    .single();
  if (error) throw error;
  return data as StaffMember;
}

export async function setStaffActive(
  client: SupabaseClient,
  organizationId: string,
  staffId: string,
  active: boolean,
) {
  await requireBusinessOrganization(client, organizationId);
  const { data, error } = await client
    .from("glam_staff")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", staffId)
    .select("id,organization_id,name,specialty,phone,active")
    .single();
  if (error) throw error;
  return data as StaffMember;
}
