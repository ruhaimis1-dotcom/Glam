import { chromium, devices, expect as baseExpect } from "@playwright/test";
import { randomUUID, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { openSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

// Supabase may retry a 503 read before publishing the error state. Locator
// timeouts do not configure expect's separate default five-second deadline.
const expect = baseExpect.configure({ timeout: 15000 });

// Opt-in: called only by the fresh, schema-verified local Docker runner.
export async function runBrowserContract({ baseURL, anon, admin, sql, dir }) {
  if (new URL(baseURL).hostname !== "127.0.0.1") throw Error("Nonlocal backend refused");
  const appURL = "http://127.0.0.1:4175";
  const accounts = {};
  for (const role of ["owner", "manager", "customer", "specialist"]) {
    const email = `browser-${role}-${randomUUID()}@example.test`;
    const password = randomBytes(24).toString("hex");
    const r = await fetch(`${baseURL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${admin}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    if (!r.ok) throw Error(`Local account provisioning failed: ${r.status}`);
    accounts[role] = { email, password, id: (await r.json()).id };
  }
  const org = randomUUID();
  sql(`insert into public.glam_organizations(id,name,status) values ('${org}','Browser review salon','active');
    insert into public.glam_memberships(organization_id,user_id,role) values ('${org}','${accounts.owner.id}','owner'),('${org}','${accounts.specialist.id}','specialist'),('${org}','${accounts.manager.id}','manager');
    insert into public.glam_salon_pages(organization_id,slug,title,published) values ('${org}','browser-${org}','Browser review',true);`);
  const checks = [],
    blockers = [],
    deliveryChecks = [],
    external = [];
  const pass = (label) => {
    checks.push(label);
    console.log(`PASS ${label}`);
  };
  const serverLog = openSync(join(dir, "vite.log"), "w");
  const server = spawn(
    process.execPath,
    [
      resolve("node_modules/vite/bin/vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      "4175",
      "--strictPort",
    ],
    {
      windowsHide: true,
      stdio: ["ignore", serverLog, serverLog],
      env: { ...process.env, VITE_SUPABASE_URL: baseURL, VITE_SUPABASE_PUBLISHABLE_KEY: anon },
    },
  );
  let browser;
  try {
    let ready = false;
    for (let i = 0; i < 90; i++) {
      if (server.exitCode !== null) throw Error("Local Vite failed; inspect ignored vite.log");
      try {
        const r = await fetch(`${appURL}/login`, { signal: AbortSignal.timeout(2000) });
        if (r.ok) {
          ready = true;
          break;
        }
      } catch {
        /* startup */
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!ready) throw Error("Local Vite startup timed out");
    browser = await chromium.launch({
      channel: process.env.GLAM_TEST_BROWSER || "msedge",
      headless: true,
    });
    console.log(`BROWSER_READY: ${process.env.GLAM_TEST_BROWSER || "msedge"} ${browser.version()}`);
    for (const [device, options] of [
      ["desktop", { viewport: { width: 1440, height: 1000 } }],
      ["mobile", { ...devices["Pixel 7"] }],
    ]) {
      const context = await browser.newContext({
        ...options,
        locale: "ar-SA",
        serviceWorkers: "block",
      });
      await context.route("**/*", (route) => {
        const u = new URL(route.request().url());
        if (!["127.0.0.1", "localhost"].includes(u.hostname)) {
          external.push(u.origin);
          return route.abort();
        }
        return route.continue();
      });
      const page = await context.newPage();
      const browserErrors = [];
      page.on("pageerror", (error) => browserErrors.push(error.message));
      page.setDefaultTimeout(15000);
      const shot = (name) =>
        page.screenshot({ path: join(dir, `${device}-${name}.png`), fullPage: true });
      async function login(role, record = true) {
        await page.goto(`${appURL}/login`, { waitUntil: "networkidle" });
        await page.getByLabel("البريد الإلكتروني").fill(accounts[role].email);
        await page.getByLabel("كلمة المرور", { exact: true }).fill(accounts[role].password);
        await page.getByRole("button", { name: "دخول", exact: true }).click();
        await expect(page).toHaveURL(
          ["owner", "manager"].includes(role) ? /\/business$/ : /\/bookings$/,
        );
        if (record) pass(`${device}: ${role} logs in through UI`);
      }
      try {
        await login("owner");
        await page.goto(`${appURL}/business/services`);
        await page.getByRole("button", { name: "إضافة خدمة", exact: true }).click();
        const name = `خدمة اختبار ${device}`;
        await page.getByLabel("اسم الخدمة", { exact: true }).fill(name);
        await page.getByLabel("متاحة للحجز", { exact: true }).check();
        await page.getByLabel("قناة التقديم", { exact: true }).selectOption("salon");
        await shot("service-basics");
        await page.getByRole("button", { name: "التالي", exact: true }).click();
        await page.getByLabel("السعر (ر.س)", { exact: true }).fill("120");
        await page.getByLabel("المدة (دقيقة)", { exact: true }).fill("45");
        await shot("service-price");
        await page.getByRole("button", { name: "حفظ الخدمة", exact: true }).click();
        const card = page
          .locator("article")
          .filter({ has: page.getByRole("heading", { name, exact: true }) });
        await expect(card).toBeVisible();
        await expect(card).toContainText("120 ر.س");
        pass(`${device}: owner creates service via rendered form`);
        await card.getByRole("button", { name: "تعديل الخدمة" }).click();
        await expect(page.getByLabel("قناة التقديم", { exact: true })).toHaveValue("salon");
        await page.getByLabel("قناة التقديم", { exact: true }).selectOption("home");
        const edited = `${name} معدلة`;
        await page.getByLabel("اسم الخدمة", { exact: true }).fill(edited);
        await page.getByRole("button", { name: "التالي", exact: true }).click();
        await page.getByLabel("السعر (ر.س)", { exact: true }).fill("155");
        await page.getByRole("button", { name: "حفظ الخدمة", exact: true }).click();
        await expect(page.locator("article").filter({ hasText: edited })).toContainText("155 ر.س");
        await page.reload();
        await expect(page.getByRole("heading", { name: edited, exact: true })).toBeVisible();
        await shot("service-saved");
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
        pass(`${device}: edit persists after reload without horizontal overflow`);
        await login("manager", false);
        await page.goto(appURL + "/business/services");
        await page
          .locator("article")
          .filter({ hasText: edited })
          .getByRole("button", { name: "تعديل الخدمة" })
          .click();
        await expect(page.getByLabel("قناة التقديم", { exact: true })).toHaveValue("home");
        await page.getByLabel("قناة التقديم", { exact: true }).selectOption("both");
        await page.getByRole("button", { name: "التالي", exact: true }).click();
        await expect(page.getByLabel("السعر (ر.س)", { exact: true })).toHaveValue("155");
        await expect(page.getByLabel("المدة (دقيقة)", { exact: true })).toHaveValue("45");
        await page.getByRole("button", { name: "حفظ الخدمة", exact: true }).click();
        await expect(page.locator("article").filter({ hasText: edited })).toContainText("كلاهما");
        await page.reload();
        await page
          .locator("article")
          .filter({ hasText: edited })
          .getByRole("button", { name: "تعديل الخدمة" })
          .click();
        await expect(page.getByLabel("قناة التقديم", { exact: true })).toHaveValue("both");
        await page.getByRole("button", { name: "إلغاء", exact: true }).click();
        deliveryChecks.push(
          device +
            ": owner creates salon, edits home; manager saves/rereads both without price/duration change",
        );
        // Fault injection only for this local browser request, never production.
        const fault = (route) =>
          route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ message: "LOCAL_TEST_UNAVAILABLE" }),
          });
        await page.route("**/rest/v1/glam_services?**", fault);
        await page.reload();
        await expect(page.getByRole("alert")).toBeVisible();
        await expect(page.getByRole("button", { name: "إضافة خدمة", exact: true })).toBeDisabled();
        await shot("service-error");
        await page.unroute("**/rest/v1/glam_services?**", fault);
        await page.getByRole("button", { name: "إعادة تحميل البيانات" }).click();
        await expect(page.getByRole("heading", { name: edited, exact: true })).toBeVisible();
        pass(`${device}: catalog error blocks writes and retry recovers`);
        const sid = sql(
          `select id from public.glam_services where organization_id='${org}' and name='${edited}';`,
        ).trim();
        expect(sid).toMatch(/^[0-9a-f-]{36}$/);
        const appointment = randomUUID();
        const days = device === "desktop" ? 2 : 3;
        // Existing booking route uses a static salon slug/name. Seed a local slot
        // with that display name; service/price/id remain the real UI-created row.
        sql(`insert into public.glam_service_specialists(service_id,specialist_id) values ('${sid}','${accounts.specialist.id}');
          insert into public.glam_schedule_windows(organization_id,specialist_id,kind,starts_at,ends_at) values ('${org}','${accounts.specialist.id}','shift',date_trunc('day',now())+interval '${days} days 12 hours',date_trunc('day',now())+interval '${days} days 20 hours');
          insert into public.glam_appointments(id,organization_id,specialist_id,salon_name,specialist_name,service_name,starts_at,ends_at,price_sar,service_id,service_revision)
          select '${appointment}','${org}','${accounts.specialist.id}','لوميير ستوديو','Test specialist',name,date_trunc('day',now())+interval '${days} days 12 hours',date_trunc('day',now())+interval '${days} days 12 hours 45 minutes',price_sar,id,revision from public.glam_services where id='${sid}';`);
        await login("customer");
        await page.goto(`${appURL}/business/services`);
        await expect(page.getByRole("button", { name: "إضافة خدمة", exact: true })).toHaveCount(0);
        await expect(page.getByRole("alert")).toContainText(
          "هذه اللوحة متاحة لمالكة المؤسسة أو مديرتها فقط.",
        );
        pass(`${device}: account switch removes owner management access`);
        await page.goto(`${appURL}/salon/${org}`);
        await page.getByRole("link", { name: "اختاري الخدمة والموعد" }).click();
        await expect(page).toHaveURL(new RegExp(`/salon/${org}/bookimport { chromium, devices, expect as baseExpect } from "@playwright/test";
import { randomUUID, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { openSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

// Supabase may retry a 503 read before publishing the error state. Locator
// timeouts do not configure expect's separate default five-second deadline.
const expect = baseExpect.configure({ timeout: 15000 });

// Opt-in: called only by the fresh, schema-verified local Docker runner.
export async function runBrowserContract({ baseURL, anon, admin, sql, dir }) {
  if (new URL(baseURL).hostname !== "127.0.0.1") throw Error("Nonlocal backend refused");
  const appURL = "http://127.0.0.1:4175";
  const accounts = {};
  for (const role of ["owner", "manager", "customer", "specialist"]) {
    const email = `browser-${role}-${randomUUID()}@example.test`;
    const password = randomBytes(24).toString("hex");
    const r = await fetch(`${baseURL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${admin}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    if (!r.ok) throw Error(`Local account provisioning failed: ${r.status}`);
    accounts[role] = { email, password, id: (await r.json()).id };
  }
  const org = randomUUID();
  sql(`insert into public.glam_organizations(id,name,status) values ('${org}','Browser review salon','active');
    insert into public.glam_memberships(organization_id,user_id,role) values ('${org}','${accounts.owner.id}','owner'),('${org}','${accounts.specialist.id}','specialist'),('${org}','${accounts.manager.id}','manager');
    insert into public.glam_salon_pages(organization_id,slug,title,published) values ('${org}','browser-${org}','Browser review',true);`);
  const checks = [],
    blockers = [],
    deliveryChecks = [],
    external = [];
  const pass = (label) => {
    checks.push(label);
    console.log(`PASS ${label}`);
  };
  const serverLog = openSync(join(dir, "vite.log"), "w");
  const server = spawn(
    process.execPath,
    [
      resolve("node_modules/vite/bin/vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      "4175",
      "--strictPort",
    ],
    {
      windowsHide: true,
      stdio: ["ignore", serverLog, serverLog],
      env: { ...process.env, VITE_SUPABASE_URL: baseURL, VITE_SUPABASE_PUBLISHABLE_KEY: anon },
    },
  );
  let browser;
  try {
    let ready = false;
    for (let i = 0; i < 90; i++) {
      if (server.exitCode !== null) throw Error("Local Vite failed; inspect ignored vite.log");
      try {
        const r = await fetch(`${appURL}/login`, { signal: AbortSignal.timeout(2000) });
        if (r.ok) {
          ready = true;
          break;
        }
      } catch {
        /* startup */
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!ready) throw Error("Local Vite startup timed out");
    browser = await chromium.launch({
      channel: process.env.GLAM_TEST_BROWSER || "msedge",
      headless: true,
    });
    console.log(`BROWSER_READY: ${process.env.GLAM_TEST_BROWSER || "msedge"} ${browser.version()}`);
    for (const [device, options] of [
      ["desktop", { viewport: { width: 1440, height: 1000 } }],
      ["mobile", { ...devices["Pixel 7"] }],
    ]) {
      const context = await browser.newContext({
        ...options,
        locale: "ar-SA",
        serviceWorkers: "block",
      });
      await context.route("**/*", (route) => {
        const u = new URL(route.request().url());
        if (!["127.0.0.1", "localhost"].includes(u.hostname)) {
          external.push(u.origin);
          return route.abort();
        }
        return route.continue();
      });
      const page = await context.newPage();
      const browserErrors = [];
      page.on("pageerror", (error) => browserErrors.push(error.message));
      page.setDefaultTimeout(15000);
      const shot = (name) =>
        page.screenshot({ path: join(dir, `${device}-${name}.png`), fullPage: true });
      async function login(role, record = true) {
        await page.goto(`${appURL}/login`, { waitUntil: "networkidle" });
        await page.getByLabel("البريد الإلكتروني").fill(accounts[role].email);
        await page.getByLabel("كلمة المرور", { exact: true }).fill(accounts[role].password);
        await page.getByRole("button", { name: "دخول", exact: true }).click();
        await expect(page).toHaveURL(
          ["owner", "manager"].includes(role) ? /\/business$/ : /\/bookings$/,
        );
        if (record) pass(`${device}: ${role} logs in through UI`);
      }
      try {
        await login("owner");
        await page.goto(`${appURL}/business/services`);
        await page.getByRole("button", { name: "إضافة خدمة", exact: true }).click();
        const name = `خدمة اختبار ${device}`;
        await page.getByLabel("اسم الخدمة", { exact: true }).fill(name);
        await page.getByLabel("متاحة للحجز", { exact: true }).check();
        await page.getByLabel("قناة التقديم", { exact: true }).selectOption("salon");
        await shot("service-basics");
        await page.getByRole("button", { name: "التالي", exact: true }).click();
        await page.getByLabel("السعر (ر.س)", { exact: true }).fill("120");
        await page.getByLabel("المدة (دقيقة)", { exact: true }).fill("45");
        await shot("service-price");
        await page.getByRole("button", { name: "حفظ الخدمة", exact: true }).click();
        const card = page
          .locator("article")
          .filter({ has: page.getByRole("heading", { name, exact: true }) });
        await expect(card).toBeVisible();
        await expect(card).toContainText("120 ر.س");
        pass(`${device}: owner creates service via rendered form`);
        await card.getByRole("button", { name: "تعديل الخدمة" }).click();
        await expect(page.getByLabel("قناة التقديم", { exact: true })).toHaveValue("salon");
        await page.getByLabel("قناة التقديم", { exact: true }).selectOption("home");
        const edited = `${name} معدلة`;
        await page.getByLabel("اسم الخدمة", { exact: true }).fill(edited);
        await page.getByRole("button", { name: "التالي", exact: true }).click();
        await page.getByLabel("السعر (ر.س)", { exact: true }).fill("155");
        await page.getByRole("button", { name: "حفظ الخدمة", exact: true }).click();
        await expect(page.locator("article").filter({ hasText: edited })).toContainText("155 ر.س");
        await page.reload();
        await expect(page.getByRole("heading", { name: edited, exact: true })).toBeVisible();
        await shot("service-saved");
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
        pass(`${device}: edit persists after reload without horizontal overflow`);
        await login("manager", false);
        await page.goto(appURL + "/business/services");
        await page
          .locator("article")
          .filter({ hasText: edited })
          .getByRole("button", { name: "تعديل الخدمة" })
          .click();
        await expect(page.getByLabel("قناة التقديم", { exact: true })).toHaveValue("home");
        await page.getByLabel("قناة التقديم", { exact: true }).selectOption("both");
        await page.getByRole("button", { name: "التالي", exact: true }).click();
        await expect(page.getByLabel("السعر (ر.س)", { exact: true })).toHaveValue("155");
        await expect(page.getByLabel("المدة (دقيقة)", { exact: true })).toHaveValue("45");
        await page.getByRole("button", { name: "حفظ الخدمة", exact: true }).click();
        await expect(page.locator("article").filter({ hasText: edited })).toContainText("كلاهما");
        await page.reload();
        await page
          .locator("article")
          .filter({ hasText: edited })
          .getByRole("button", { name: "تعديل الخدمة" })
          .click();
        await expect(page.getByLabel("قناة التقديم", { exact: true })).toHaveValue("both");
        await page.getByRole("button", { name: "إلغاء", exact: true }).click();
        deliveryChecks.push(
          device +
            ": owner creates salon, edits home; manager saves/rereads both without price/duration change",
        );
        // Fault injection only for this local browser request, never production.
        const fault = (route) =>
          route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ message: "LOCAL_TEST_UNAVAILABLE" }),
          });
        await page.route("**/rest/v1/glam_services?**", fault);
        await page.reload();
        await expect(page.getByRole("alert")).toBeVisible();
        await expect(page.getByRole("button", { name: "إضافة خدمة", exact: true })).toBeDisabled();
        await shot("service-error");
        await page.unroute("**/rest/v1/glam_services?**", fault);
        await page.getByRole("button", { name: "إعادة تحميل البيانات" }).click();
        await expect(page.getByRole("heading", { name: edited, exact: true })).toBeVisible();
        pass(`${device}: catalog error blocks writes and retry recovers`);
        const sid = sql(
          `select id from public.glam_services where organization_id='${org}' and name='${edited}';`,
        ).trim();
        expect(sid).toMatch(/^[0-9a-f-]{36}$/);
        const appointment = randomUUID();
        const days = device === "desktop" ? 2 : 3;
        // Existing booking route uses a static salon slug/name. Seed a local slot
        // with that display name; service/price/id remain the real UI-created row.
        sql(`insert into public.glam_service_specialists(service_id,specialist_id) values ('${sid}','${accounts.specialist.id}');
          insert into public.glam_schedule_windows(organization_id,specialist_id,kind,starts_at,ends_at) values ('${org}','${accounts.specialist.id}','shift',date_trunc('day',now())+interval '${days} days 12 hours',date_trunc('day',now())+interval '${days} days 20 hours');
          insert into public.glam_appointments(id,organization_id,specialist_id,salon_name,specialist_name,service_name,starts_at,ends_at,price_sar,service_id,service_revision)
          select '${appointment}','${org}','${accounts.specialist.id}','لوميير ستوديو','Test specialist',name,date_trunc('day',now())+interval '${days} days 12 hours',date_trunc('day',now())+interval '${days} days 12 hours 45 minutes',price_sar,id,revision from public.glam_services where id='${sid}';`);
        await login("customer");
        await page.goto(`${appURL}/business/services`);
        await expect(page.getByRole("button", { name: "إضافة خدمة", exact: true })).toHaveCount(0);
        await expect(page.getByRole("alert")).toContainText(
          "هذه اللوحة متاحة لمالكة المؤسسة أو مديرتها فقط.",
        );
        pass(`${device}: account switch removes owner management access`);
        await page.goto(`${appURL}/salon/${org}`);
        await page.getByRole("link", { name: "اختاري الخدمة والموعد" }).click();
));
        await expect(page.getByRole("heading", { name: "احجزي في لوميير ستوديو" })).toBeVisible();
        await page
          .getByRole("combobox", { name: /^التصنيف الرئيسي/ })
          .selectOption({ label: "خدمات أخرى" });
        await page.getByRole("combobox", { name: /^الخدمة/ }).selectOption(sid);
        await expect(page.getByText(/السعر.*155/)).toBeVisible();
        await shot("customer-service");
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
        pass(`${device}: customer sees edited service and price in actual booking UI`);
        await expect(
          page.getByLabel("قناة التقديم", { exact: true }).locator("option"),
        ).toHaveCount(3);
        await page.getByLabel("قناة التقديم", { exact: true }).selectOption("home");
        await page.route("**/rest/v1/glam_appointments?**", fault);
        await page.reload();
        await expect(page.getByRole("alert")).toContainText("تعذر تحميل");
        await expect(page.getByRole("button", { name: "تأكيد الحجز", exact: true })).toHaveCount(0);
        await shot("booking-error");
        await page.unroute("**/rest/v1/glam_appointments?**", fault);
        await page.getByRole("button", { name: "إعادة المحاولة" }).click();
        await page
          .getByRole("combobox", { name: /^التصنيف الرئيسي/ })
          .selectOption({ label: "خدمات أخرى" });
        await page.getByRole("combobox", { name: /^الخدمة/ }).selectOption(sid);
        pass(`${device}: booking failure has no fallback and retry restores service`);
        const date = sql(
          `select to_char(starts_at at time zone 'UTC','YYYY-MM-DD') from public.glam_appointments where id='${appointment}';`,
        ).trim();
        const channels = page.getByLabel("قناة التقديم", { exact: true });
        // Real local DB changes simulate channel becoming unavailable after load.
        await channels.selectOption("home");
        sql(
          `update public.glam_service_delivery_options set enabled=false where service_id='${sid}' and channel='home';`,
        );
        await page.getByRole("combobox", { name: /^الموعد/ }).selectOption(date);
        await page.getByRole("combobox", { name: /^الوقت/ }).selectOption(appointment);
        await page.getByRole("button", { name: "تأكيد الحجز", exact: true }).click();
        await expect(page.getByRole("alert")).toContainText("قناة التقديم لم تعد متاحة");
        await page.getByRole("button", { name: "إعادة تحميل الخدمات" }).click();
        await page
          .getByRole("combobox", { name: /^التصنيف الرئيسي/ })
          .selectOption({ label: "خدمات أخرى" });
        await page.getByRole("combobox", { name: /^الخدمة/ }).selectOption(sid);
        await expect(channels.locator("option")).toHaveCount(2);
        await expect(channels.locator('option[value="home"]')).toHaveCount(0);
        sql(
          `update public.glam_service_delivery_options set enabled=false where service_id='${sid}';`,
        );
        await page.reload();
        await page
          .getByRole("combobox", { name: /^التصنيف الرئيسي/ })
          .selectOption({ label: "خدمات أخرى" });
        await page.getByRole("combobox", { name: /^الخدمة/ }).selectOption(sid);
        await expect(
          page.getByText("لا توجد قناة تقديم متاحة لهذه الخدمة بالسعر والمدة المعروضين."),
        ).toBeVisible();
        await expect(page.getByRole("button", { name: "تأكيد الحجز", exact: true })).toBeDisabled();
        sql(
          `update public.glam_service_delivery_options set enabled=true where service_id='${sid}' and channel='home';`,
        );
        await page.reload();
        await page
          .getByRole("combobox", { name: /^التصنيف الرئيسي/ })
          .selectOption({ label: "خدمات أخرى" });
        await page.getByRole("combobox", { name: /^الخدمة/ }).selectOption(sid);
        await expect(channels.locator('option[value="salon"]')).toHaveCount(0);
        await channels.selectOption("home");
        await page.getByRole("combobox", { name: /^الموعد/ }).selectOption(date);
        await page.getByRole("combobox", { name: /^الوقت/ }).selectOption(appointment);
        await page.getByRole("button", { name: "تأكيد الحجز", exact: true }).click();
        deliveryChecks.push(
          device + ": only valid channels shown; stale/empty rejected; home booking persisted",
        );
        await expect(
          page.getByRole("heading", { name: "تم تأكيد الحجز", exact: true }),
        ).toBeVisible();
        expect(
          sql(
            `select count(*) from public.glam_reservations where appointment_id='${appointment}' and customer_id='${accounts.customer.id}' and status='confirmed' and delivery_channel='home';`,
          ).trim(),
        ).toBe("1");
        await shot("booking-confirmed");
        pass(`${device}: customer booking persists locally`);
        await page.goto(`${appURL}/profile`);
        const displayName = `عميلة اختبار ${device}`;
        await page.getByLabel("اسمك", { exact: true }).fill(displayName);
        await page.getByRole("button", { name: "حفظ الاسم", exact: true }).click();
        await expect(page.getByRole("status")).toContainText("تم حفظ اسمك.");
        await page.reload();
        await expect(page.getByLabel("اسمك", { exact: true })).toHaveValue(displayName);
        expect(
          sql(
            `select display_name from public.glam_profiles where user_id='${accounts.customer.id}';`,
          ).trim(),
        ).toBe(displayName);
        pass(`${device}: profile name saves to database and persists after reload`);
        await page.goto(`${appURL}/bookings`);
        await expect(page.getByText(edited, { exact: false })).toBeVisible();
        await page.route("**/rest/v1/glam_reservations?**", fault);
        await page.reload();
        await expect(page.getByRole("alert")).toContainText("تعذر تحميل حجوزاتك");
        await expect(page.getByText(edited, { exact: false })).toHaveCount(0);
        await page.unroute("**/rest/v1/glam_reservations?**", fault);
        await page.getByRole("button", { name: "إعادة المحاولة", exact: true }).click();
        await expect(page.getByText(edited, { exact: false })).toBeVisible();
        pass(`${device}: booking list error clears stale data and retry recovers`);
        const emptyReservations = (route) =>
          route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
        await page.route("**/rest/v1/glam_reservations?**", emptyReservations);
        await page.reload();
        await expect(page.getByText("ما عندك حجوزات إلى الآن", { exact: true })).toBeVisible();
        await expect(page.getByText(edited, { exact: false })).toHaveCount(0);
        await page.unroute("**/rest/v1/glam_reservations?**", emptyReservations);
        pass(`${device}: empty server booking list does not reuse cached bookings`);
        await login("owner", false);
        await page.goto(`${appURL}/bookings`);
        await expect(page.getByText("ما عندك حجوزات إلى الآن", { exact: true })).toBeVisible();
        await expect(page.getByText(edited, { exact: false })).toHaveCount(0);
        await page.goto(`${appURL}/profile`);
        await expect(page.getByLabel("اسمك", { exact: true })).not.toHaveValue(displayName);
        pass(`${device}: account switch cannot expose another customer's bookings or profile`);
      } catch (error) {
        await shot("failure");
        writeFileSync(join(dir, `${device}-failure.txt`), await page.locator("body").innerText());
        writeFileSync(join(dir, `${device}-errors.json`), JSON.stringify(browserErrors));
        throw error;
      } finally {
        await context.close();
      }
    }
    if (external.some((origin) => origin.includes("supabase.co")))
      throw Error("Application attempted a nonlocal Supabase request (blocked)");
    for (const label of deliveryChecks) console.log(`PASS DELIVERY ${label}`);
    return {
      passed: checks.length,
      checks,
      blockers,
      deliveryChecks,
      browser: browser.version(),
      externalOriginsBlocked: [...new Set(external)],
    };
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}
