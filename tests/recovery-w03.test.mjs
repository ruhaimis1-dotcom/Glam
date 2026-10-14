import test from "node:test";
import assert from "node:assert/strict";
import { createRecoveryActions, parseRecoveryLink, shouldDetectAuthSession, recoveryMessage } from "../src/lib/recovery-flow.ts";
import { resolvePostLogin } from "../src/lib/post-login.ts";
import { bookingDateKey } from "../src/lib/booking-time.ts";

const token = "a".repeat(64);
const metrics = { organizations: 1, bookings: 0, open_disputes: 0, accounts: 1 };
const now = 1_800_000_000_000;
function fixture(overrides = {}) {
  const calls = [];
  const user = { id: "recovery-user" };
  const session = { user, expires_at: now / 1000 + 3600 };
  const auth = {
    getSession: async () => ({ data: { session }, error: null }),
    getUser: async () => ({ data: { user }, error: null }),
    verifyOtp: async (args) => { calls.push(["verify", args]); return { data: { session, user }, error: null }; },
    resetPasswordForEmail: async (...args) => { calls.push(["request", args]); return { data: {}, error: null }; },
    updateUser: async (args) => { calls.push(["save", args]); return { data: { user }, error: null }; },
    signOut: async (args) => { calls.push(["signout", args]); return { error: null }; },
    ...overrides,
  };
  return { calls, auth, actions: createRecoveryActions(auth, () => now) };
}

test("approved link is parsed, never verified by parsing", () => {
  assert.deepEqual(parseRecoveryLink(`?token_hash=${token}&type=recovery&next=https://untrusted.invalid`, ""), { kind: "confirm", tokenHash: token });
});
test("clean reset URL has no assumed recovery permission", () => {
  assert.deepEqual(parseRecoveryLink("", ""), { kind: "clean" });
});
for (const search of [`?token_hash=${token}&type=signup`, `?token_hash=${token}`, `?token_hash=x&type=recovery`, `?token_hash=${token}&token_hash=${token}&type=recovery`, `?token_hash=${token}&type=recovery&type=recovery`, "?code=old", "?token=old"]) {
  test("reject malformed/unsupported link " + search.slice(0, 32), () => {
    assert.equal(parseRecoveryLink(search, "").kind, "error");
  });
}
test("expired error takes precedence over a valid-looking token", () => {
  assert.deepEqual(parseRecoveryLink(`?token_hash=${token}&type=recovery`, "#error=access_denied&error_code=otp_expired"), { kind: "error", code: "expired_link" });
});
test("legacy implicit credentials are not consumed automatically", () => {
  assert.equal(parseRecoveryLink("", "#access_token=secret&refresh_token=secret&type=recovery").kind, "error");
  assert.equal(shouldDetectAuthSession("/auth/confirm"), false);
  assert.equal(shouldDetectAuthSession("/reset-password/"), false);
  assert.equal(shouldDetectAuthSession("/login"), true);
  assert.equal(shouldDetectAuthSession("/"), true);
});
test("creating actions and resuming a missing recovery session never verifies, sends email or saves", async () => {
  const { calls, actions } = fixture({ getSession: async () => ({ data: { session: null }, error: null }) });
  assert.deepEqual(await actions.resume(), { kind: "request" });
  assert.deepEqual(calls, []);
});
test("explicit verify uses only recovery type and confirms identity", async () => {
  const { calls, actions } = fixture();
  assert.deepEqual(await actions.verify(token), { kind: "ready", userId: "recovery-user" });
  assert.deepEqual(calls, [["verify", { token_hash: token, type: "recovery" }]]);
});
test("expired or used verification never succeeds", async () => {
  const { actions } = fixture({ verifyOtp: async () => ({ data: { user: null, session: null }, error: { code: "otp_expired" } }) });
  assert.deepEqual(await actions.verify(token), { kind: "error", code: "expired_link" });
});
test("unconfirmed or mismatched verification data fails closed", async () => {
  for (const data of [{ user: null, session: null }, { user: { id: "A" }, session: { user: { id: "B" } } }]) {
    const { actions } = fixture({ verifyOtp: async () => ({ data, error: null }) });
    assert.equal((await actions.verify(token)).kind, "error");
  }
});
test("concurrent explicit verification sends one request", async () => {
  let resolve, count = 0;
  const { actions } = fixture({ verifyOtp: () => { count++; return new Promise((r) => { resolve = r; }); } });
  const first = actions.verify(token);
  assert.deepEqual(await actions.verify(token), { kind: "error", code: "busy" });
  resolve({ data: { session: null, user: null }, error: { code: "otp_expired" } });
  await first; assert.equal(count, 1);
});
test("request normalizes email, fixed same-origin callback, suppresses immediate repeat", async () => {
  const { actions, calls } = fixture();
  assert.deepEqual(await actions.request("  Salon@Example.invalid  ", "https://glam.invalid"), { kind: "sent" });
  assert.deepEqual(await actions.request("salon@example.invalid", "https://glam.invalid"), { kind: "error", code: "rate_limited" });
  assert.deepEqual(calls, [["request", ["salon@example.invalid", { redirectTo: "https://glam.invalid/reset-password" }]]]);
});
test("provider rate limiting and network errors are explicit, not success", async () => {
  assert.deepEqual(await fixture({ resetPasswordForEmail: async () => ({ error: { status: 429 } }) }).actions.request("x@x.invalid", "https://glam.invalid"), { kind: "error", code: "rate_limited" });
  assert.deepEqual(await fixture({ resetPasswordForEmail: async () => { throw new Error("private provider detail"); } }).actions.request("x@x.invalid", "https://glam.invalid"), { kind: "error", code: "unavailable" });
});
test("password validation prevents a write", async () => {
  const { actions, calls } = fixture();
  assert.deepEqual(await actions.save("recovery-user", "short", "short"), { kind: "error", code: "password_short" });
  assert.deepEqual(await actions.save("recovery-user", "Synthetic-Only-1", "different"), { kind: "error", code: "password_mismatch" });
  assert.deepEqual(calls, []);
});
test("only verified recovery identity may save; missing/expired/switched identities never write", async () => {
  for (const overrides of [
    { getSession: async () => ({ data: { session: null }, error: null }) },
    { getSession: async () => ({ data: { session: { user: { id: "recovery-user" }, expires_at: now / 1000 - 1 } }, error: null }) },
    { getUser: async () => ({ data: { user: { id: "different-user" } }, error: null }) },
  ]) {
    const { calls, actions } = fixture(overrides);
    assert.deepEqual(await actions.save("recovery-user", "Synthetic-Only-1", "Synthetic-Only-1"), { kind: "error", code: "account_changed" });
    assert.deepEqual(calls, []);
  }
});
test("save requires confirmed same user response and signs out ONLY recovery local session", async () => {
  const { actions, calls } = fixture();
  assert.deepEqual(await actions.save("recovery-user", "Synthetic-Only-1", "Synthetic-Only-1"), { kind: "saved", signedOut: true });
  assert.deepEqual(calls, [["save", { password: "Synthetic-Only-1" }], ["signout", { scope: "local" }]]);
});
test("password update null/error is never reported as success", async () => {
  for (const value of [{ data: { user: null }, error: null }, { data: { user: { id: "recovery-user" } }, error: { status: 500 } }]) {
    const { actions } = fixture({ updateUser: async () => value });
    assert.equal((await actions.save("recovery-user", "Synthetic-Only-1", "Synthetic-Only-1")).kind, "error");
  }
});
test("signout failure does not misreport a confirmed password update as failed", async () => {
  const { actions } = fixture({ signOut: async () => { throw Error("network"); } });
  assert.deepEqual(await actions.save("recovery-user", "Synthetic-Only-1", "Synthetic-Only-1"), { kind: "saved", signedOut: false });
});
test("concurrent resumes are read-only and compatible with strict-mode mounting", async () => {
  const { actions } = fixture();
  const results = await Promise.all([actions.resume(), actions.resume()]);
  assert(results.every((value) => value.kind === "ready"));
});
test("messages never expose raw tokens or provider details", () => {
  for (const code of ["invalid_link", "expired_link", "unavailable", "account_changed", "password_short", "password_mismatch", "rate_limited", "busy"])
    assert(!recoveryMessage(code).includes(token));
});
function loginReads(role = "customer") {
  return {
    identity: async () => ({ data: { user: { id: "user-A" } }, error: null }),
    admin: async () => role === "admin" ? { data: metrics, error: null } : { data: null, error: { code: "42501", message: "FORBIDDEN" } },
    businesses: async () => role === "owner" || role === "manager" ? [{ id: "org-A" }] : [],
  };
}
for (const [role, route] of [["admin", "/admin"], ["owner", "/business"], ["manager", "/business"], ["customer", "/bookings"]]) {
  test("role routing uses verified permission, not email: " + role, async () => {
    assert.equal(await resolvePostLogin(loginReads(role), "user-A"), route);
  });
}
test("role lookup permission/configuration errors do not become customer routes", async () => {
  for (const admin of [async () => ({ data: null, error: null }), async () => ({ data: null, error: { code: "42501", message: "permission denied for function" } }), async () => ({ data: null, error: { code: "PGRST202" } })])
    await assert.rejects(resolvePostLogin({ ...loginReads(), admin }, "user-A"), /LOGIN_ACCESS_UNCONFIRMED/);
});
test("account switch while checking destination cancels navigation", async () => {
  let n = 0;
  const reads = { ...loginReads("owner"), identity: async () => ({ data: { user: { id: ++n === 1 ? "user-A" : "user-B" } }, error: null }) };
  await assert.rejects(resolvePostLogin(reads, "user-A"), /LOGIN_IDENTITY_CHANGED/);
});
test("unmounted login cannot publish a destination", async () => {
  await assert.rejects(resolvePostLogin(loginReads("admin"), "user-A", () => false), /LOGIN_IDENTITY_CHANGED/);
});
for (const [value, day] of [["2026-10-13T21:30:00Z", "2026-10-14"], ["2026-10-13T22:30:00Z", "2026-10-14"], ["2026-10-14T20:59:59Z", "2026-10-14"], ["2026-10-14T21:00:00Z", "2026-10-15"]]) {
  test("Riyadh date boundary: " + value, () => { assert.equal(bookingDateKey(value), day); });
}
