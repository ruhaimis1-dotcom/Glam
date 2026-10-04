import type { SupabaseClient } from "@supabase/supabase-js";

export interface CustomerProfile {
  userId: string;
  displayName: string;
}
export function createCustomerProfileRepository(client: SupabaseClient) {
  async function currentUser() {
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user) throw new Error("AUTH_REQUIRED");
    return user.id;
  }
  async function load(): Promise<CustomerProfile> {
    const userId = await currentUser();
    const { data, error } = await client
      .from("glam_profiles")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return { userId, displayName: data?.display_name ?? "" };
  }
  async function save(expectedUserId: string, name: string): Promise<CustomerProfile> {
    const displayName = name.trim();
    if (!displayName || displayName.length > 80) throw new Error("INVALID_NAME");
    const userId = await currentUser();
    if (userId !== expectedUserId) throw new Error("ACCOUNT_CHANGED");
    const { data: existing, error: readError } = await client
      .from("glam_profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (readError) throw readError;
    // Update only the name; preserve all stored preferences and future consent fields.
    const query = existing
      ? client.from("glam_profiles").update({ display_name: displayName }).eq("user_id", userId)
      : client.from("glam_profiles").insert({ user_id: userId, display_name: displayName });
    const { data, error } = await query.select("user_id,display_name").single();
    if (error) throw error;
    if (!data || data.user_id !== userId) throw new Error("WRITE_NOT_CONFIRMED");
    return { userId, displayName: data.display_name };
  }
  return { load, save };
}
