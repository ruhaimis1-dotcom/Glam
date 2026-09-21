import { supabase } from "@/lib/supabase";

export async function getCurrentOrganization() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { user: null, organizationId: null, role: null };

  const { data } = await supabase
    .from("glam_memberships")
    .select("organization_id,role")
    .eq("user_id", auth.user.id)
    .limit(1)
    .maybeSingle();

  return {
    user: auth.user,
    organizationId: data?.organization_id ?? null,
    role: data?.role ?? null,
  };
}
