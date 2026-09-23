import { createClient } from "@supabase/supabase-js";

const url = import.meta.env["VITE_SUPABASE_URL"] || "https://tevqysdswqkgqartpzdg.supabase.co";
const key =
  import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
  "sb_publishable_05nO36grifvVvUykQK_F8Q_o-eYCclp";

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// Supabase client import verified for Vercel build.
