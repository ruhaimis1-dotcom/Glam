import type { SupabaseClient } from "@supabase/supabase-js";

export type RecoveryCode =
  | "invalid_link"
  | "expired_link"
  | "unavailable"
  | "account_changed"
  | "password_short"
  | "password_mismatch"
  | "rate_limited"
  | "busy";
export type RecoveryResult =
  | { kind: "ready"; userId: string }
  | { kind: "request" }
  | { kind: "sent" }
  | { kind: "saved"; signedOut: boolean }
  | { kind: "error"; code: RecoveryCode };
export type RecoveryLink =
  | { kind: "confirm"; tokenHash: string }
  | { kind: "clean" }
  | { kind: "error"; code: "invalid_link" | "expired_link" };

const validToken = (value: string) => /^[a-zA-Z0-9_-]{20,512}$/.test(value);

/** Only the reviewed token_hash/recovery template is accepted. Never follow next/redirect_to. */
export function parseRecoveryLink(search: string, hash: string): RecoveryLink {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  for (const params of [query, fragment]) {
    if (params.get("error_code") === "otp_expired")
      return { kind: "error", code: "expired_link" };
    if (params.has("error") || params.has("error_code"))
      return { kind: "error", code: "invalid_link" };
  }
  // Old implicit/PKCE links are not silently treated as successful recovery sessions.
  for (const params of [query, fragment]) {
    if (["access_token", "refresh_token", "code", "token"].some((key) => params.has(key)))
      return { kind: "error", code: "invalid_link" };
  }
  if (fragment.has("token_hash") || fragment.has("type"))
    return { kind: "error", code: "invalid_link" };
  if (!query.has("token_hash") && !query.has("type")) return { kind: "clean" };
  const tokens = query.getAll("token_hash");
  const types = query.getAll("type");
  if (tokens.length !== 1 || types.length !== 1 || types[0] !== "recovery" || !validToken(tokens[0]!))
    return { kind: "error", code: "invalid_link" };
  return { kind: "confirm", tokenHash: tokens[0]! };
}

export function shouldDetectAuthSession(pathname: string) {
  const path = pathname.replace(/\/+$/, "");
  return path !== "/auth/confirm" && path !== "/reset-password";
}

export function recoveryMessage(code: RecoveryCode): string {
  const messages: Record<RecoveryCode, string> = {
    invalid_link: "رابط الاستعادة غير صالح أو من النسخة السابقة. اطلبي رابطًا جديدًا.",
    expired_link: "انتهت صلاحية رابط الاستعادة أو تم استخدامه. اطلبي رابطًا جديدًا.",
    unavailable: "تعذر تأكيد العملية الآن. تحققي من الاتصال وحاولي مرة أخرى.",
    account_changed: "جلسة الاستعادة لم تعد صالحة لهذا الحساب. اطلبي رابطًا جديدًا.",
    password_short: "يجب أن تتكون كلمة المرور من 8 أحرف أو أكثر.",
    password_mismatch: "كلمتا المرور غير متطابقتين.",
    rate_limited: "تم إرسال طلب مؤخرًا. انتظري قليلًا قبل إعادة المحاولة.",
    busy: "العملية قيد التنفيذ، يرجى الانتظار.",
  };
  return messages[code];
}

function providerCode(error: unknown): RecoveryCode {
  if (error && typeof error === "object") {
    const value = error as { code?: unknown; status?: unknown };
    if (value.code === "otp_expired") return "expired_link";
    if (value.status === 429 || value.code === "over_email_send_rate_limit") return "rate_limited";
  }
  return "unavailable";
}

type RecoveryAuth = Pick<SupabaseClient["auth"],
  "getSession" | "getUser" | "verifyOtp" | "resetPasswordForEmail" | "updateUser" | "signOut">;

/** Use ONLY the dedicated recovery client, never the app's normal signed-in client. */
export function createRecoveryActions(auth: RecoveryAuth, now: () => number = Date.now) {
  let busy = false;
  let nextRequestAt = 0;
  async function exclusive(action: () => Promise<RecoveryResult>): Promise<RecoveryResult> {
    if (busy) return { kind: "error", code: "busy" };
    busy = true;
    try { return await action(); }
    catch (error) { return { kind: "error", code: providerCode(error) }; }
    finally { busy = false; }
  }
  async function identity(): Promise<RecoveryResult> {
    const session = await auth.getSession();
    if (session.error) return { kind: "error", code: providerCode(session.error) };
    const value = session.data.session;
    if (!value) return { kind: "request" };
    if (!value.expires_at || value.expires_at * 1000 <= now())
      return { kind: "error", code: "expired_link" };
    const user = await auth.getUser();
    if (user.error || !user.data.user || user.data.user.id !== value.user.id)
      return { kind: "error", code: "account_changed" };
    return { kind: "ready", userId: user.data.user.id };
  }
  return {
    resume: async (): Promise<RecoveryResult> => {
      try { return await identity(); }
      catch (error) { return { kind: "error", code: providerCode(error) }; }
    },
    verify: (tokenHash: string) => exclusive(async () => {
      if (!validToken(tokenHash)) return { kind: "error", code: "invalid_link" };
      const result = await auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
      if (result.error) return { kind: "error", code: providerCode(result.error) };
      if (!result.data.session || !result.data.user || result.data.session.user.id !== result.data.user.id)
        return { kind: "error", code: "invalid_link" };
      return identity();
    }),
    request: (email: string, origin: string) => exclusive(async () => {
      if (now() < nextRequestAt) return { kind: "error", code: "rate_limited" };
      const normalized = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))
        return { kind: "error", code: "unavailable" };
      const url = new URL(origin);
      if (!["https:", "http:"].includes(url.protocol) || url.origin !== origin)
        return { kind: "error", code: "unavailable" };
      const result = await auth.resetPasswordForEmail(normalized, { redirectTo: `${origin}/reset-password` });
      if (result.error) {
        const code = providerCode(result.error);
        if (code === "rate_limited") nextRequestAt = now() + 60_000;
        return { kind: "error", code };
      }
      nextRequestAt = now() + 60_000;
      return { kind: "sent" };
    }),
    save: (userId: string, password: string, confirmation: string) => exclusive(async () => {
      if (password.length < 8) return { kind: "error", code: "password_short" };
      if (password !== confirmation) return { kind: "error", code: "password_mismatch" };
      const current = await identity();
      if (current.kind !== "ready" || current.userId !== userId)
        return { kind: "error", code: "account_changed" };
      const updated = await auth.updateUser({ password });
      if (updated.error) return { kind: "error", code: providerCode(updated.error) };
      if (!updated.data.user || updated.data.user.id !== userId)
        return { kind: "error", code: "unavailable" };
      // Never revoke all devices or the main application user's unrelated session.
      let signedOut = false;
      try { signedOut = !(await auth.signOut({ scope: "local" })).error; } catch { /* saved is still true */ }
      return { kind: "saved", signedOut };
    }),
  };
}
