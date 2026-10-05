import type { SupabaseClient } from "@supabase/supabase-js";

export const PASSPORT_SCOPES = [
  "profile",
  "sensitivities",
  "service_history",
  "preferences",
  "photos",
] as const;
export type PassportScope = (typeof PASSPORT_SCOPES)[number];

type PassportConsentRow = {
  id: string;
  organization_id: string;
  scopes: string[] | null;
  granted_at: string;
  expires_at: string | null;
  glam_organizations: { name: string } | null;
};

export type PassportConsent = {
  id: string;
  organizationId: string;
  organizationName: string;
  scopes: PassportScope[];
  grantedAt: string;
  expiresAt: string | null;
};

function schemaUnavailable(error: { code?: string } | null) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

export function createPassportConsentRepository(client: SupabaseClient) {
  async function currentUserId() {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw new Error("AUTH_REQUIRED");
    return data.user.id;
  }

  return {
    async list(): Promise<PassportConsent[]> {
      const userId = await currentUserId();
      const { data, error } = await client
        .from("glam_passport_consents")
        .select("id,organization_id,scopes,granted_at,expires_at,glam_organizations(name)")
        .eq("customer_id", userId)
        .is("revoked_at", null)
        .order("granted_at", { ascending: false });
      if (schemaUnavailable(error)) throw new Error("CONSENT_NOT_ENABLED");
      if (error) throw error;
      return (data ?? []).map((row: PassportConsentRow) => ({
        id: row.id,
        organizationId: row.organization_id,
        organizationName: row.glam_organizations?.name ?? "صالون",
        scopes: (row.scopes ?? []).filter((scope: string) =>
          PASSPORT_SCOPES.includes(scope as PassportScope),
        ),
        grantedAt: row.granted_at,
        expiresAt: row.expires_at,
      }));
    },

    async revoke(consentId: string) {
      const userId = await currentUserId();
      const { data, error } = await client
        .from("glam_passport_consents")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", consentId)
        .eq("customer_id", userId)
        .is("revoked_at", null)
        .select("id")
        .single();
      if (schemaUnavailable(error)) throw new Error("CONSENT_NOT_ENABLED");
      if (error || !data) throw error ?? new Error("CONSENT_NOT_CONFIRMED");
      return data.id as string;
    },
  };
}
