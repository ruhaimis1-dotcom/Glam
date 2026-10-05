import type { SupabaseClient } from "@supabase/supabase-js";

export type BeautyPassport = {
  customerId: string;
  hair: Record<string, unknown>;
  skin: Record<string, unknown>;
  nails: Record<string, unknown>;
  sensitivities: string[];
  preferences: Record<string, unknown>;
  customerNotes: string;
};

function schemaUnavailable(error: { code?: string } | null) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

export function createBeautyPassportRepository(client: SupabaseClient) {
  return {
    async load(): Promise<BeautyPassport | null> {
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth.user) throw new Error("AUTH_REQUIRED");
      const { data, error } = await client
        .from("glam_beauty_passports")
        .select("customer_id,hair,skin,nails,sensitivities,preferences,customer_notes")
        .eq("customer_id", auth.user.id)
        .maybeSingle();
      if (schemaUnavailable(error)) throw new Error("PASSPORT_NOT_ENABLED");
      if (error) throw error;
      if (!data) return null;
      return {
        customerId: data.customer_id,
        hair: data.hair ?? {},
        skin: data.skin ?? {},
        nails: data.nails ?? {},
        sensitivities: Array.isArray(data.sensitivities) ? data.sensitivities : [],
        preferences: data.preferences ?? {},
        customerNotes: data.customer_notes ?? "",
      };
    },

    async save(passport: BeautyPassport): Promise<BeautyPassport> {
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth.user || auth.user.id !== passport.customerId)
        throw new Error("AUTH_REQUIRED");
      const { data, error } = await client
        .from("glam_beauty_passports")
        .upsert({
          customer_id: auth.user.id,
          hair: passport.hair,
          skin: passport.skin,
          nails: passport.nails,
          sensitivities: passport.sensitivities,
          preferences: passport.preferences,
          customer_notes: passport.customerNotes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .select("customer_id,hair,skin,nails,sensitivities,preferences,customer_notes")
        .single();
      if (schemaUnavailable(error)) throw new Error("PASSPORT_NOT_ENABLED");
      if (error) throw error;
      return {
        customerId: data.customer_id,
        hair: data.hair ?? {},
        skin: data.skin ?? {},
        nails: data.nails ?? {},
        sensitivities: Array.isArray(data.sensitivities) ? data.sensitivities : [],
        preferences: data.preferences ?? {},
        customerNotes: data.customer_notes ?? "",
      };
    },
  };
}
