import type { SupabaseClient } from "@supabase/supabase-js";
import { requireBusinessOrganization } from "../lib/business-access.ts";

export type StaffMember = {
  id: string;
  organization_id: string;
  name: string;
  specialty: string;
  phone: string | null;
  active: boolean;
};

type TeamMemberRow = {
  id: string;
  organization_id: string;
  name: string;
  role: string;
  active: boolean;
};

function normalizeStaff(row: TeamMemberRow): StaffMember {
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    specialty: row.role,
    phone: null,
    active: row.active,
  };
}

export async function listStaff(
  client: SupabaseClient,
  organizationId: string,
): Promise<StaffMember[]> {
  await requireBusinessOrganization(client, organizationId);
  const { data, error } = await client
    .from("glam_team_members")
    .select("id,organization_id,name,role,active")
    .eq("organization_id", organizationId)
    .order("active", { ascending: false })
    .order("name");
  if (error) throw error;
  return ((data ?? []) as TeamMemberRow[]).map(normalizeStaff);
}

export async function createStaff(
  client: SupabaseClient,
  organizationId: string,
  input: { name: string; specialty: string; phone?: string },
) {
  await requireBusinessOrganization(client, organizationId);
  const name = input.name.trim();
  const role = input.specialty.trim();
  if (name.length < 1 || role.length < 1) throw new Error("INVALID_INPUT");
  const { data, error } = await client
    .from("glam_team_members")
    .insert({ organization_id: organizationId, name, role, active: true })
    .select("id,organization_id,name,role,active")
    .single();
  if (error) throw error;
  return normalizeStaff(data as TeamMemberRow);
}

export async function setStaffActive(
  client: SupabaseClient,
  organizationId: string,
  staffId: string,
  active: boolean,
) {
  await requireBusinessOrganization(client, organizationId);
  const { data, error } = await client
    .from("glam_team_members")
    .update({ active })
    .eq("organization_id", organizationId)
    .eq("id", staffId)
    .select("id,organization_id,name,role,active")
    .single();
  if (error) throw error;
  return normalizeStaff(data as TeamMemberRow);
}
