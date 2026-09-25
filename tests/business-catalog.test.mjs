import assert from "node:assert/strict";
import test from "node:test";
import { createCatalogRepository } from "../src/repositories/service-intelligence.ts";
import { listBusinessOrganizations } from "../src/lib/business-access.ts";
import { validateService, catalogError } from "../src/domain/business-catalog.ts";

// Contract fake, NOT a database/RLS emulator. No connection or production write.
function fixture({ role = "owner", user = { id: "user", email: "different@example.com" } } = {}) {
  const tables = {
    glam_memberships: [
      { user_id: "user", organization_id: "a", role },
      { user_id: "other", organization_id: "b", role: "owner" },
    ],
    glam_organizations: [
      { id: "a", name: "صالون أ" },
      { id: "b", name: "صالون ب" },
    ],
    glam_services: [{ ...input, id: "s-b", organization_id: "b", revision: 1 }],
    glam_service_categories: [{ id: "c-b", organization_id: "b", name: "خاص ب" }],
    glam_service_subcategories: [
      { id: "sub-b", organization_id: "b", category_id: "c-b", name: "فرعي ب" },
    ],
  };
  const calls = [];
  const failures = {};
  let sequence = 0;
  const client = {
    auth: { getUser: async () => ({ data: { user }, error: failures.auth ?? null }) },
    from(table) {
      const filters = [];
      const call = { table, filters };
      calls.push(call);
      const builder = {
        select(columns) {
          call.columns = columns;
          return builder;
        },
        eq(column, value) {
          filters.push((row) => row[column] === value);
          return builder;
        },
        in(column, values) {
          filters.push((row) => values.includes(row[column]));
          return builder;
        },
        order() {
          return builder;
        },
        then(resolve, reject) {
          return Promise.resolve({
            data: tables[table].filter((row) => filters.every((f) => f(row))),
            error: failures[table] ?? null,
          }).then(resolve, reject);
        },
      };
      return builder;
    },
    async rpc(name, args) {
      calls.push({ rpc: name, args });
      if (failures.rpc) return { data: null, error: failures.rpc };
      if (failures.noResult) return { data: null, error: null };
      const id = args.p_id ?? `new-${++sequence}`;
      const table = name.includes("category")
        ? args.p_parent || args.p_subcategory
          ? "glam_service_subcategories"
          : "glam_service_categories"
        : "glam_services";
      if (name.includes("delete")) tables[table] = tables[table].filter((row) => row.id !== id);
      else {
        const row = name.includes("category")
          ? {
              id,
              organization_id: args.p_org,
              name: args.p_name,
              ...(args.p_parent ? { category_id: args.p_parent } : {}),
              active: true,
              sort_order: 0,
            }
          : {
              id,
              organization_id: args.p_org,
              name: args.p_name,
              minutes: args.p_minutes,
              price_sar: args.p_price,
              active: args.p_active,
              category_id: args.p_category,
              subcategory_id: args.p_subcategory,
              pricing_mode: args.p_pricing_mode,
              buffer_minutes: args.p_buffer,
              revision: 1,
            };
        tables[table] = [...tables[table].filter((item) => item.id !== id), row];
      }
      return { data: id, error: null };
    },
  };
  return { client, tables, calls, failures, repo: createCatalogRepository(client) };
}
const input = {
  name: "قص",
  minutes: 60,
  price_sar: 0,
  active: false,
  category_id: null,
  subcategory_id: null,
  pricing_mode: "fixed",
  buffer_minutes: 15,
};

for (const role of ["owner", "manager"])
  test(`${role} access follows membership, not email`, async () => {
    const f = fixture({ role });
    assert.deepEqual(await listBusinessOrganizations(f.client), [
      { id: "a", name: "صالون أ", role },
    ]);
  });
for (const role of ["specialist", "customer", "admin"])
  test(`${role} cannot manage a business catalog`, async () => {
    const f = fixture({ role });
    assert.deepEqual(await listBusinessOrganizations(f.client), []);
    await assert.rejects(f.repo.saveService("a", null, input), /FORBIDDEN/);
    assert.equal(
      f.calls.some((call) => call.rpc),
      false,
    );
  });
test("anonymous requests never query business data", async () => {
  const f = fixture({ user: null });
  await assert.rejects(f.repo.load("a"), /AUTH_REQUIRED/);
  assert.equal(f.calls.length, 0);
});
test("membership and organization lookup errors fail closed", async () => {
  for (const table of ["glam_memberships", "glam_organizations"]) {
    const f = fixture();
    f.failures[table] = new Error("offline");
    await assert.rejects(f.repo.saveCategory("a", null, "شعر"), /offline/);
    assert.equal(
      f.calls.some((call) => call.rpc),
      false,
    );
  }
});
test("multiple memberships are all returned for explicit selection", async () => {
  const f = fixture();
  f.tables.glam_memberships.push({ user_id: "user", organization_id: "b", role: "manager" });
  assert.equal((await listBusinessOrganizations(f.client)).length, 2);
  assert.deepEqual((await f.repo.load("a")).services, []);
  assert.equal((await f.repo.load("b")).services[0].id, "s-b");
});
test("every catalog collection is filtered to the selected organization", async () => {
  const f = fixture();
  assert.deepEqual(await f.repo.load("a"), { services: [], categories: [], subcategories: [] });
  const servicesRead = f.calls.find((call) => call.table === "glam_services");
  assert.match(servicesRead.columns, /price_sar/);
  assert.doesNotMatch(servicesRead.columns, /name_ar|status|duration_minutes/);
});
test("all operations reject a forged organization before RPC", async () => {
  const f = fixture();
  for (const action of [
    () => f.repo.load("b"),
    () => f.repo.saveService("b", null, input),
    () => f.repo.deleteService("b", "s-b"),
    () => f.repo.saveCategory("b", null, "شعر"),
    () => f.repo.deleteCategory("b", "c-b", false),
  ])
    await assert.rejects(action(), /FORBIDDEN/);
  assert.equal(
    f.calls.some((call) => call.rpc),
    false,
  );
});
test("service CRUD contract preserves persisted identity, zero price, inactive state and classification", async () => {
  const f = fixture();
  const id = await f.repo.saveService("a", null, { ...input, name: " قص " });
  let rows = (await f.repo.load("a")).services;
  assert.equal(rows[0].id, id);
  assert.equal(rows[0].price_sar, 0);
  assert.equal(rows[0].active, false);
  assert.equal(rows[0].name, "قص");
  await f.repo.saveService("a", id, {
    ...input,
    name: "قص وتصفيف",
    category_id: "category-a",
    subcategory_id: "subcategory-a",
    pricing_mode: "from",
    buffer_minutes: 30,
  });
  rows = (await f.repo.load("a")).services;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, id);
  assert.equal(rows[0].category_id, "category-a");
  assert.equal(rows[0].subcategory_id, "subcategory-a");
  assert.equal(rows[0].buffer_minutes, 30);
  await f.repo.deleteService("a", id);
  assert.equal((await f.repo.load("a")).services.length, 0);
  assert.equal(f.tables.glam_services[0].id, "s-b");
});
test("category and subcategory CRUD contract retains tenant and parent", async () => {
  const f = fixture();
  const category = await f.repo.saveCategory("a", null, " شعر ");
  const subcategory = await f.repo.saveCategory("a", null, "قص", category);
  await f.repo.saveCategory("a", category, "خدمات الشعر");
  await f.repo.saveCategory("a", subcategory, "قص وتصفيف", category);
  const catalog = await f.repo.load("a");
  assert.equal(catalog.categories[0].name, "خدمات الشعر");
  assert.equal(catalog.subcategories[0].category_id, category);
  await f.repo.deleteCategory("a", subcategory, true);
  await f.repo.deleteCategory("a", category, false);
  assert.deepEqual(await f.repo.load("a"), { services: [], categories: [], subcategories: [] });
});
test("ownership is rechecked after membership revocation", async () => {
  const f = fixture();
  await f.repo.load("a");
  f.tables.glam_memberships = [];
  await assert.rejects(f.repo.saveService("a", null, input), /FORBIDDEN/);
  assert.equal(
    f.calls.some((call) => call.rpc),
    false,
  );
});
test("RPC cross-tenant/FK errors propagate, without a second write or local success", async () => {
  for (const code of ["42501", "23503", "23505", "PGRST202"]) {
    const f = fixture();
    f.failures.rpc = { code, message: "server rejected" };
    await assert.rejects(f.repo.saveService("a", "s-b", input), (error) => error.code === code);
    assert.equal(f.calls.filter((call) => call.rpc).length, 1);
    assert.equal(f.calls.find((call) => call.rpc).args.p_org, "a");
    assert.equal(f.tables.glam_services[0].organization_id, "b");
  }
});
test("zero-result writes are not treated as successful", async () => {
  const f = fixture();
  f.failures.noResult = true;
  for (const action of [
    () => f.repo.saveService("a", null, input),
    () => f.repo.deleteService("a", "missing"),
    () => f.repo.saveCategory("a", null, "شعر"),
    () => f.repo.deleteCategory("a", "missing", false),
  ])
    await assert.rejects(action(), /WRITE_NOT_CONFIRMED/);
});
test("read errors do not produce empty or preview fallback catalogs", async () => {
  for (const table of ["glam_services", "glam_service_categories", "glam_service_subcategories"]) {
    const f = fixture();
    f.failures[table] = { code: "42501" };
    await assert.rejects(f.repo.load("a"), (error) => error.code === "42501");
  }
});
test("service validation follows verified database constraints", () => {
  for (const change of [
    { name: " " },
    { name: "x".repeat(121) },
    { minutes: 0 },
    { minutes: 16 },
    { minutes: 495 },
    { price_sar: NaN },
    { price_sar: -1 },
    { price_sar: 10001 },
    { buffer_minutes: 121 },
    { buffer_minutes: 1.5 },
    { pricing_mode: "starts_from" },
    { subcategory_id: "sub" },
  ])
    assert.throws(() => validateService({ ...input, ...change }), /INVALID_/);
  assert.doesNotThrow(() => validateService(input));
});
test("category length validation runs before any request", async () => {
  const f = fixture();
  await assert.rejects(f.repo.saveCategory("a", null, "x".repeat(81)), /INVALID_NAME/);
  await assert.rejects(f.repo.saveCategory("a", null, "x".repeat(121), "parent"), /INVALID_NAME/);
  assert.equal(f.calls.length, 0);
});
test("errors have actionable Arabic messages without raw database details", () => {
  assert.match(catalogError({ code: "PGRST202" }), /صلاحيات/);
  assert.match(catalogError({ code: "23503" }), /مرتبطة/);
  assert.doesNotMatch(catalogError(new Error("secret db detail")), /secret/);
});
