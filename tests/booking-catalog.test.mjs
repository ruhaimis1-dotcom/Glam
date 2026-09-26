import assert from "node:assert/strict";
import test from "node:test";
import {
  loadBookingCatalog,
  startBookingCatalogLoad,
} from "../src/repositories/booking-catalog.ts";

const serviceId = "10000000-0000-4000-8000-000000000001";
const variantId = "20000000-0000-4000-8000-000000000001";
const appointment = {
  id: "30000000-0000-4000-8000-000000000001",
  service_id: serviceId,
  service_variant_id: null,
  service_name: "Old name must never become identity",
  starts_at: "2030-01-01T10:00:00Z",
};
const service = {
  id: serviceId,
  name: "Haircut",
  price_sar: 0,
  minutes: 45,
  active: true,
  category_id: null,
  glam_service_categories: null,
  glam_service_variants: [],
};
function fixture() {
  const responses = {
    glam_appointments: { data: [appointment], error: null },
    glam_services: { data: [service], error: null },
  };
  const calls = [];
  const client = {
    from(table) {
      const call = { table, filters: [] };
      calls.push(call);
      const query = {
        select(columns) {
          call.columns = columns;
          return query;
        },
        eq(...args) {
          call.filters.push(args);
          return query;
        },
        gte() {
          return query;
        },
        in(...args) {
          call.filters.push(args);
          return query;
        },
        order() {
          return query;
        },
        then(resolve, reject) {
          return Promise.resolve(responses[table]).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return { client, calls, responses };
}

test("appointment errors stop loading before any catalog read", async () => {
  const f = fixture();
  const error = { code: "42501" };
  f.responses.glam_appointments.error = error;
  await assert.rejects(loadBookingCatalog(f.client, "Salon"), (e) => e === error);
  assert.equal(f.calls.length, 1);
});

test("catalog permission or relationship errors never become appointment-derived services", async () => {
  for (const code of ["42501", "PGRST201", "PGRST200"]) {
    const f = fixture();
    const error = { code };
    f.responses.glam_services.error = error;
    await assert.rejects(loadBookingCatalog(f.client, "Salon"), (e) => e === error);
  }
});

test("retry reads both collections afresh and preserves real identity, zero price and duration", async () => {
  const f = fixture();
  f.responses.glam_services.error = new Error("offline");
  await assert.rejects(loadBookingCatalog(f.client, "Salon"), /offline/);
  f.responses.glam_services.error = null;
  const result = await loadBookingCatalog(f.client, "Salon");
  assert.equal(f.calls.length, 4);
  assert.deepEqual(result.catalog[0], {
    id: serviceId,
    name: "Haircut",
    price: 0,
    minutes: 45,
    categoryName: "خدمات أخرى",
    variants: [],
  });
  assert.equal(result.appointments[0].service_id, serviceId);
  const query = f.calls.find((call) => call.table === "glam_services");
  assert.deepEqual(query.filters, [
    ["id", [serviceId]],
    ["active", true],
  ]);
  // Composite FKs must not make the existing PostgREST relationship ambiguous.
  assert.match(query.columns, /!glam_services_category_id_fkey/);
});

test("empty or RLS-hidden catalogs remain empty without synthetic prices or IDs", async () => {
  const f = fixture();
  f.responses.glam_services.data = [];
  assert.deepEqual(await loadBookingCatalog(f.client, "Salon"), { appointments: [], catalog: [] });
  f.responses.glam_appointments.data = [{ ...appointment, service_id: null }];
  f.calls.length = 0;
  assert.deepEqual(await loadBookingCatalog(f.client, "Salon"), { appointments: [], catalog: [] });
  assert.equal(f.calls.length, 1);
});

test("missing price, duration, UUID or linked category is a load failure, never a default", async () => {
  for (const change of [
    { price_sar: null },
    { minutes: null },
    { id: "Haircut" },
    { price_sar: "" },
    { minutes: 0 },
    { category_id: variantId },
  ]) {
    const f = fixture();
    f.responses.glam_services.data = [{ ...service, ...change }];
    await assert.rejects(loadBookingCatalog(f.client, "Salon"));
  }
});

test("inactive services and variants cannot supply bookable appointments", async () => {
  const f = fixture();
  f.responses.glam_services.data = [{ ...service, active: false }];
  assert.deepEqual(await loadBookingCatalog(f.client, "Salon"), { appointments: [], catalog: [] });
  f.responses.glam_services.data = [
    {
      ...service,
      glam_service_variants: [
        { id: variantId, name: "Long", price_sar: 100, minutes: 90, active: false },
      ],
    },
  ];
  f.responses.glam_appointments.data = [{ ...appointment, service_variant_id: variantId }];
  const result = await loadBookingCatalog(f.client, "Salon");
  assert.deepEqual(result.catalog[0].variants, []);
  assert.deepEqual(result.appointments, []);
});

test("null response data and network rejections are not successful empty results", async () => {
  const f = fixture();
  f.responses.glam_services.data = null;
  await assert.rejects(loadBookingCatalog(f.client, "Salon"));
  await assert.rejects(
    loadBookingCatalog(
      {
        from() {
          throw new Error("network");
        },
      },
      "Salon",
    ),
    /network/,
  );
});

const flush = () => new Promise((resolve) => setImmediate(resolve));

test("failed read publishes an explicit error with no data; retry clears it before succeeding", async () => {
  const f = fixture();
  const states = [];
  f.responses.glam_services.error = { code: "42501" };
  startBookingCatalogLoad(f.client, "Salon", (state) => states.push(state));
  await flush();
  assert.deepEqual(states, [{ status: "loading" }, { status: "error" }]);
  f.responses.glam_services.error = null;
  startBookingCatalogLoad(f.client, "Salon", (state) => states.push(state));
  assert.deepEqual(states.at(-1), { status: "loading" });
  await flush();
  assert.equal(states.at(-1).status, "ready");
  assert.equal(states.at(-1).data.catalog[0].id, serviceId);
});

test("a cancelled request cannot overwrite a retry or another salon with data or an error", async () => {
  for (const response of [
    { data: [service], error: null },
    { data: null, error: { code: "42501" } },
  ]) {
    const old = fixture();
    let settle;
    old.responses.glam_services = new Promise((resolve) => {
      settle = resolve;
    });
    const states = [];
    const cancel = startBookingCatalogLoad(old.client, "Old", (state) => states.push(state));
    await flush();
    cancel();
    const next = fixture();
    next.responses.glam_services.data = [];
    startBookingCatalogLoad(next.client, "Next", (state) => states.push(state));
    await flush();
    const count = states.length;
    settle(response);
    await flush();
    assert.equal(states.length, count);
    assert.deepEqual(states.at(-1), { status: "ready", data: { catalog: [], appointments: [] } });
  }
});
