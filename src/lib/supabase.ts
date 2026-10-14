import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { shouldDetectAuthSession } from "./recovery-flow";

const url = import.meta.env["VITE_SUPABASE_URL"] || "https://tevqysdswqkgqartpzdg.supabase.co";
const key =
  import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
  "sb_publishable_05nO36grifvVvUykQK_F8Q_o-eYCclp";

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: typeof window === "undefined" || shouldDetectAuthSession(window.location.pathname),
  },
});

let recoveryClient: SupabaseClient | undefined;

/** Recovery never adopts or mutates the normal application's signed-in account. */
export function getRecoveryClient(): SupabaseClient {
  if (typeof window === "undefined") throw new Error("RECOVERY_BROWSER_REQUIRED");
  if (!recoveryClient) {
    let storage: Storage | undefined;
    try { storage = window.sessionStorage; } catch { /* memory-only fallback */ }
    recoveryClient = createClient(url, key, {
      auth: {
        storageKey: "glam-recovery-auth-v1",
        ...(storage ? { storage } : {}),
        persistSession: Boolean(storage),
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return recoveryClient;
}
