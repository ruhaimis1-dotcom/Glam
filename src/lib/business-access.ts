import type { SupabaseClient } from "@supabase/supabase-js";

export type BusinessOrganization = { id: string; name: string; role: "owner" | "manager" };

export async function listBusinessOrganizations(
  client: SupabaseClient,
): Promise<BusinessOrganization[]> {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error("AUTH_REQUIRED");
  const { data: memberships, error } = await client
    .from("glam_memberships")
    .select("organization_id,role")
    .eq("user_id", auth.user.id)
    .in("role", ["owner", "manager"]);
  if (error) throw error;
  if (!memberships?.length) return [];
  const { data: organizations, error: orgError } = await client
    .from("glam_organizations")
    .select("id,name")
    .in(
      "id",
      memberships.map((m) => m.organization_id),
    )
    .order("name");
  if (orgError) throw orgError;
  return (organizations ?? []).map((org) => ({
    ...org,
    role: memberships.find((m) => m.organization_id === org.id)!.role,
  }));
}

export async function requireBusinessOrganization(client: SupabaseClient, id: string) {
  const organizations = await listBusinessOrganizations(client);
  const organization = organizations.find((org) => org.id === id);
  if (!organization) throw new Error("FORBIDDEN");
  return organization;
}
