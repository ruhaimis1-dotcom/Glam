// Actual application, React, Router and browser. Auth/HTTP responses are synthetic.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
const app = "http://127.0.0.1:43178";
const api = "http://127.0.0.1:54321";
const primaryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const recoveryId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const org = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const serviceId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const appointmentId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const hash = "a".repeat(64);
const metrics = { organizations: 1, bookings: 0, open_disputes: 0, accounts: 1 };
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
function session(id) {
  const user = { id, aud: "authenticated", role: "authenticated", email: "fixture@glam.invalid", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [], created_at: "2026-10-14T00:00:00Z" };
  return { access_token: encode({ alg: "HS256", typ: "JWT" }) + "." + encode({ sub: id, role: "authenticated", aud: "authenticated", exp: 4102444800 }) + ".synthetic_test_signature", refresh_token: "synthetic-" + id, token_type: "bearer", expires_at: 4102444800, expires_in: 999999, user };
}
const primary = session(primaryId), recovery = session(recoveryId);
let browser, passed = 0, output = "";
const executablePath = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium"].find((p) => fs.existsSync(p));
assert(executablePath, "BLOCKED: no installed browser; no paid service/download attempted");
const child = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "dev", "--host", "127.0.0.1", "--port", "43178", "--strictPort"], { env: process.env, stdio: ["ignore", "pipe", "pipe"] });
for (const stream of [child.stdout, child.stderr]) stream.on("data", (b) => { output = (output + b).slice(-2000); });
async function fixture(viewport, { existing = true, role = "customer" } = {}) {
  const context = await browser.newContext({ viewport, serviceWorkers: "block" });
  if (existing) await context.addInitScript((value) => localStorage.setItem("sb-127-auth-token", JSON.stringify(value)), primary);
  const calls = [], unknown = [], errors = [];
  let used = false, updateFails = true, adminFails = false;
  await context.route("**/*", async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === app) return route.continue();
    if (url.origin !== api) return route.abort("blockedbyclient");
    const method = request.method();
    const body = request.postDataJSON();
    const isRecovery = request.headers()["authorization"] === "Bearer " + recovery.access_token;
    calls.push({ path: url.pathname, method, body, isRecovery });
    const reply = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "Access-Control-Allow-Origin": app, "Access-Control-Allow-Headers": "*" }, body: status === 204 ? "" : JSON.stringify(body) });
    if (method === "OPTIONS") return reply({});
    if (url.pathname === "/auth/v1/verify") {
      assert.equal(body.type, "recovery"); assert.equal(body.token_hash, hash);
      await delay(80);
      if (used) return reply({ code: "otp_expired", msg: "synthetic used link" }, 403);
      used = true; return reply(recovery);
    }
    if (url.pathname === "/auth/v1/recover") return reply({});
    if (url.pathname === "/auth/v1/token") return reply(primary);
    if (url.pathname === "/auth/v1/logout") { assert.equal(url.searchParams.get("scope"), "local"); assert(isRecovery); return reply({}, 204); }
    if (url.pathname === "/auth/v1/user" && method === "PUT") {
      assert(isRecovery, "Password write must be bound to dedicated recovery user, never primary account");
      if (updateFails) return reply({ code: "synthetic_update_error", msg: "fixture" }, 422);
      return reply(recovery.user);
    }
    if (url.pathname === "/auth/v1/user") return reply(isRecovery ? recovery.user : primary.user);
    const key = url.pathname.replace("/rest/v1/", "");
    if (key === "rpc/glam_admin_overview") {
      if (adminFails) return reply({ code: "PGRST202", message: "fixture unavailable" }, 404);
      return role === "admin" ? reply(metrics) : reply({ code: "42501", message: "FORBIDDEN" }, 403);
    }
    if (key === "glam_memberships") return reply(role === "owner" || role === "manager" ? [{ organization_id: org, user_id: primaryId, role }] : []);
    if (key === "glam_organizations") return reply([{ id: org, name: "صالون اختبار معزول" }]);
    if (key === "glam_reservations") return reply([]);
    if (key === "glam_appointments") return reply([{ id: appointmentId, organization_id: org, salon_name: "صالون اختبار معزول", service_id: serviceId, service_variant_id: null, service_name: "خدمة اختبار", starts_at: "2030-01-01T21:30:00Z" }]);
    if (key === "glam_services") return reply([{ id: serviceId, name: "خدمة اختبار", price_sar: 100, minutes: 30, active: true, category_id: null, glam_service_categories: null, glam_service_variants: [], glam_service_delivery_options: [{ channel: "salon", enabled: true, price_sar: null, minutes: null, travel_fee_sar: 0 }] }]);
    unknown.push(url.pathname); return reply({ code: "UNHANDLED_FIXTURE" }, 500);
  });
  await context.routeWebSocket(/.*/, (ws) => { if (new URL(ws.url()).host === new URL(app).host) ws.connectToServer(); else ws.close(); });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return { context, page, calls, setUpdateSuccess: () => { updateFails = false; }, failAdmin: () => { adminFails = true; }, healAdmin: () => { adminFails = false; }, close: async () => { assert.deepEqual(unknown, []); assert.deepEqual(errors, []); await context.close(); } };
}
async function check(name, run) { await run(); passed++; console.log("PASS W03 BROWSER: " + name); }
try {
  let ready = false;
  for (let i = 0; i < 90; i++) {
    if (child.exitCode !== null) throw Error("Local Vite stopped: " + output);
    try { if ((await fetch(app + "/login")).ok) { ready = true; break; } } catch { /* wait */ }
    await delay(500);
  }
  assert(ready, "Vite startup failed: " + output);
  browser = await chromium.launch({ executablePath, headless: true, args: ["--disable-background-networking", "--disable-component-update"] });
  console.log("W03_BROWSER_VERSION: " + browser.version());
  for (const [size, viewport] of [["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }]]) {
    const f = await fixture(viewport); const { page, calls } = f;
    await check(size + " normal application session is NOT recovery", async () => {
      await page.goto(app + "/reset-password");
      await expect(page.getByLabel("البريد الإلكتروني", { exact: true })).toBeVisible();
      await expect(page.getByLabel("كلمة المرور الجديدة", { exact: true })).toHaveCount(0);
    });
    await check(size + " valid link does not auto-verify, secrets removed", async () => {
      await page.goto(app + "/auth/confirm?token_hash=" + hash + "&type=recovery&next=https://untrusted.invalid/");
      await expect(page.getByRole("button", { name: "المتابعة لتعيين كلمة المرور" })).toBeVisible();
      await expect(page).toHaveURL(app + "/auth/confirm");
      assert.equal(calls.filter((x) => x.path.endsWith("/verify")).length, 0);
    });
    await check(size + " explicit verification reaches new password form", async () => {
      await page.getByRole("button", { name: "المتابعة لتعيين كلمة المرور" }).click();
      await expect(page).toHaveURL(app + "/reset-password");
      await expect(page.getByLabel("كلمة المرور الجديدة", { exact: true })).toBeVisible();
      assert.equal(calls.filter((x) => x.path.endsWith("/verify")).length, 1);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("sb-127-auth-token")).user.id), primaryId);
      assert(!await page.evaluate((value) => JSON.stringify(sessionStorage).includes(value), hash));
    });
    await check(size + " page reload preserves dedicated recovery session", async () => {
      await page.reload(); await expect(page.getByLabel("كلمة المرور الجديدة", { exact: true })).toBeVisible();
    });
    await check(size + " mismatch blocks password write", async () => {
      await page.getByLabel("كلمة المرور الجديدة", { exact: true }).fill("Synthetic-Only-1");
      await page.getByLabel("تأكيد كلمة المرور الجديدة", { exact: true }).fill("Synthetic-Only-2");
      await page.getByRole("button", { name: "حفظ كلمة المرور" }).click();
      await expect(page.getByRole("alert")).toHaveText("كلمتا المرور غير متطابقتين.");
      assert.equal(calls.filter((x) => x.method === "PUT").length, 0);
    });
    await check(size + " provider update failure is not false success", async () => {
      await page.getByLabel("تأكيد كلمة المرور الجديدة", { exact: true }).fill("Synthetic-Only-1");
      await page.getByRole("button", { name: "حفظ كلمة المرور" }).click();
      await expect(page.getByRole("alert")).toBeVisible();
      await expect(page.getByRole("button", { name: "حفظ كلمة المرور" })).toBeVisible();
      assert.equal(calls.filter((x) => x.method === "PUT").length, 1);
    });
    await check(size + " retry saves correct recovery user without touching main account", async () => {
      f.setUpdateSuccess();
      await page.getByRole("button", { name: "حفظ كلمة المرور" }).click();
      await expect(page.getByRole("status")).toHaveText("تم تحديث كلمة المرور بنجاح. سجّلي الدخول بكلمة المرور الجديدة.");
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("sb-127-auth-token")).user.id), primaryId);
      assert.equal(calls.filter((x) => x.method === "PUT").length, 2);
      assert(calls.filter((x) => x.method === "PUT").every((x) => x.isRecovery));
    });
    await check(size + " reused link shows expiration, not password editor", async () => {
      await page.goto(app + "/auth/confirm?token_hash=" + hash + "&type=recovery");
      await page.getByRole("button", { name: "المتابعة لتعيين كلمة المرور" }).click();
      await expect(page.getByRole("alert")).toHaveText("انتهت صلاحية رابط الاستعادة أو تم استخدامه. اطلبي رابطًا جديدًا.");
      await expect(page.getByLabel("كلمة المرور الجديدة", { exact: true })).toHaveCount(0);
    });
    await check(size + " reset request is explicit, generic and rate-limited in UI", async () => {
      await page.getByLabel("البريد الإلكتروني", { exact: true }).fill("Salon@Example.invalid");
      await page.getByRole("button", { name: "إرسال رابط الاستعادة" }).click();
      await expect(page.getByRole("status")).toContainText("إذا كان البريد مرتبطًا بحساب");
      await expect(page.getByRole("button", { name: /إعادة الإرسال بعد/ })).toBeDisabled();
      assert.equal(calls.filter((x) => x.path.endsWith("/recover")).length, 1);
    });
    await check(size + " expired URL wins over normal signed-in session", async () => {
      await page.goto(app + "/reset-password#error=access_denied&error_code=otp_expired");
      await expect(page.getByRole("alert")).toContainText("انتهت صلاحية");
      await expect(page.getByLabel("كلمة المرور الجديدة", { exact: true })).toHaveCount(0);
      await expect(page).toHaveURL(app + "/reset-password");
    });
    await check(size + " legacy implicit token is not auto-adopted", async () => {
      const before = calls.filter((x) => x.path.endsWith("/verify")).length;
      await page.goto(app + "/reset-password#access_token=legacy&refresh_token=legacy&type=recovery");
      await expect(page.getByRole("alert")).toContainText("النسخة السابقة");
      assert.equal(calls.filter((x) => x.path.endsWith("/verify")).length, before);
    });
    await check(size + " actual booking date and time use Riyadh day at midnight", async () => {
      await page.goto(app + "/salon/" + org + "/book");
      await page.getByLabel("التصنيف الرئيسي", { exact: true }).selectOption({ label: "خدمات أخرى" });
      await page.getByLabel("الخدمة", { exact: true }).selectOption(serviceId);
      const days = await page.getByLabel("الموعد", { exact: true }).locator("option").evaluateAll((nodes) => nodes.map((x) => x.value));
      assert(days.includes("2030-01-02")); assert(!days.includes("2030-01-01"));
      await page.getByLabel("الموعد", { exact: true }).selectOption("2030-01-02");
      const times = await page.getByLabel("الوقت", { exact: true }).locator("option").evaluateAll((nodes) => nodes.map((x) => x.value));
      assert(times.includes(appointmentId));
    });
    await f.close();
    for (const [role, target, heading] of [["admin", "/admin", "مؤشرات المنصة"], ["owner", "/business", "لوحة تحكم الصالون"], ["manager", "/business", "لوحة تحكم الصالون"], ["customer", "/bookings", "حجوزاتي"]]) {
      const login = await fixture(viewport, { existing: false, role });
      await check(size + " real login form routes " + role + " by permissions", async () => {
        await login.page.goto(app + "/login");
        await login.page.getByLabel("البريد الإلكتروني", { exact: true }).fill("same-email@glam.invalid");
        await login.page.getByLabel("كلمة المرور", { exact: true }).fill("Synthetic-Only-1");
        await login.page.getByRole("button", { name: "دخول", exact: true }).click();
        await expect(login.page).toHaveURL(app + target);
        await expect(login.page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      });
      await login.close();
    }
    const retry = await fixture(viewport, { existing: false, role: "owner" }); retry.failAdmin();
    await check(size + " access lookup error is retryable without another password exchange", async () => {
      await retry.page.goto(app + "/login");
      await retry.page.getByLabel("البريد الإلكتروني", { exact: true }).fill("same-email@glam.invalid");
      await retry.page.getByLabel("كلمة المرور", { exact: true }).fill("Synthetic-Only-1");
      await retry.page.getByRole("button", { name: "دخول", exact: true }).click();
      await expect(retry.page.getByRole("alert")).toContainText("تم تسجيل الدخول، لكن تعذر");
      retry.healAdmin();
      await retry.page.getByRole("button", { name: "إعادة محاولة فتح الحساب" }).click();
      await expect(retry.page).toHaveURL(app + "/business");
      assert.equal(retry.calls.filter((x) => x.path === "/auth/v1/token").length, 1);
    });
    await retry.close();
  }
  console.log(JSON.stringify({ scope: "W03 real browser and app, synthetic Auth/HTTP; no mail delivered or hosted auth/persistence verified", passed, viewports: 2 }));
} finally {
  if (browser) await browser.close();
  child.kill("SIGTERM");
}
