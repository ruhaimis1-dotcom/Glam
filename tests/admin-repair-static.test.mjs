import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("admin pages use secure production RPCs and no mock data", () => {
  const overview = read("src/routes/admin.tsx");
  const salons = read("src/routes/admin.salons.tsx");
  const bookings = read("src/routes/admin.bookings.tsx");
  const disputes = read("src/routes/admin.disputes.tsx");

  assert.match(overview, /glam_admin_overview/);
  assert.match(salons, /glam_admin_salons/);
  assert.match(bookings, /glam_admin_bookings/);
  assert.match(disputes, /glam_admin_disputes/);

  for (const source of [overview, salons, bookings, disputes]) {
    assert.doesNotMatch(source, /@\/data\/mock/);
  }
  assert.doesNotMatch(bookings, /GS-1081|نيل بار الرياض|سكينة سبا/);
  assert.doesNotMatch(disputes, /النتيجة لا تطابق الصورة|خلاف على استرداد العربون/);
});

test("admin shell authorizes through platform admin RPC, not a hard-coded email", () => {
  const shells = read("src/components/glam/shells.tsx");
  assert.match(shells, /glam_admin_overview/);
  assert.doesNotMatch(shells, /saud@hirely\.sa/);
});

test("business navigation exposes clients and staff MVP labels are explicit", () => {
  const shells = read("src/components/glam/shells.tsx");
  const staff = read("src/routes/business.staff.tsx");
  assert.match(shells, /\/business\/clients/);
  assert.match(staff, /الحضور والانصراف والغياب والعلاوات ليست مفعّلة بعد/);
});
