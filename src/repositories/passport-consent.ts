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
  organization_name: string;
  scopes: string[] | null;
  granted_at: string;
  expires_at: string | null;
};

export type PassportConsent = {
  id: string;
  organizationId: string;
  organizationName: string;
  scopes: PassportScope[];
  grantedAt: string;
  expiresAt: string | null;
};

function isPassportScope(scope: string): scope is PassportScope {
  return PASSPORT_SCOPES.some((allowed) => allowed === scope);
}

function rpcUnavailable(error: { code?: string } | null) {
  return error?.code === "PGRST202" || error?.code === "42883";
}

export function createPassportConsentRepository(client: SupabaseClient) {
  async function currentUserId() {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw new Error("AUTH_REQUIRED");
    return data.user.id;
  }

  return {
    async list(): Promise<PassportConsent[]> {
      await currentUserId();
      const { data, error } = await client.rpc("glam_my_passport_consents");
      if (rpcUnavailable(error)) throw new Error("CONSENT_NOT_ENABLED");
      if (error || data === null) throw error ?? new Error("CONSENT_READ_NOT_CONFIRMED");

      return (data as PassportConsentRow[]).map((row) => ({
        id: row.id,
        organizationId: row.organization_id,
        organizationName: row.organization_name,
        scopes: (row.scopes ?? []).filter(isPassportScope),
        grantedAt: row.granted_at,
        expiresAt: row.expires_at,
      }));
    },

    async revoke(consentId: string) {
      await currentUserId();
      const { data, error } = await client.rpc("glam_revoke_passport_consent", {
        p_id: consentId,
      });
      if (rpcUnavailable(error)) throw new Error("CONSENT_NOT_ENABLED");
      if (error || !data) throw error ?? new Error("CONSENT_NOT_CONFIRMED");
      return data as string;
    },
  };
}
