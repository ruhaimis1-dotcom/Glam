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

type TeamDirectoryRow = {
  organization_id: string;
  user_id: string;
  display_name: string;
  role: "owner" | "manager" | "specialist";
};

function rpcUnavailable(error: { code?: string } | null) {
  return error?.code === "PGRST202" || error?.code === "42883";
}

export async function listStaff(
  client: SupabaseClient,
  organizationId: string,
): Promise<StaffMember[]> {
  await requireBusinessOrganization(client, organizationId);
  const { data, error } = await client.rpc("glam_business_team_directory", {
    p_org: organizationId,
  });
  if (rpcUnavailable(error)) throw new Error("TEAM_DIRECTORY_NOT_ENABLED");
  if (error || data === null) throw error ?? new Error("TEAM_READ_NOT_CONFIRMED");

  return (data as TeamDirectoryRow[])
    .filter((row) => row.organization_id === organizationId && row.role === "specialist")
    .map((row) => ({
      id: row.user_id,
      organization_id: row.organization_id,
      name: row.display_name,
      specialty: "أخصائية",
      phone: null,
      active: true,
    }));
}

export async function inviteStaff(
  client: SupabaseClient,
  organizationId: string,
  email: string,
) {
  await requireBusinessOrganization(client, organizationId);
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) throw new Error("INVALID_EMAIL");

  const { data, error } = await client.rpc("glam_create_team_invite", {
    p_org: organizationId,
    p_email: normalized,
    p_role: "specialist",
  });
  if (rpcUnavailable(error)) throw new Error("TEAM_INVITE_NOT_ENABLED");
  if (error || !data) throw error ?? new Error("TEAM_INVITE_NOT_CONFIRMED");
  return data as string;
}
