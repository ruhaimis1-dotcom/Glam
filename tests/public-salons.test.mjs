import assert from "node:assert/strict";
import test from "node:test";
import { loadPublicSalons } from "../src/repositories/public-salons.ts";

const orgA = "00000000-0000-4000-8000-000000000001";
const orgB = "00000000-0000-4000-8000-000000000002";

function clientWith(data, error = null) {
  const calls = [];
  return {
    calls,
    from(table) {
      const call = { table };
      calls.push(call);
      const query = {
        select(columns) {
          call.columns = columns;
          return query;
        },
        gte(column) {
          call.gte = column;
          return query;
        },
        order(column) {
          call.order = column;
          return query;
        },
        limit(value) {
          call.limit = value;
          return Promise.resolve({ data, error });
        },
      };
      return query;
    },
  };
}

test("public salons are derived only from persisted future appointment rows", async () => {
  const client = clientWith([
    {
      organization_id: orgA,
      salon_name: "صالون أ",
      service_name: "قص",
      starts_at: "2030-01-01T10:00:00Z",
    },
    {
      organization_id: orgA,
      salon_name: "صالون أ",
      service_name: "صبغة",
      starts_at: "2030-01-01T12:00:00Z",
    },
    {
      organization_id: orgB,
      salon_name: "صالون ب",
      service_name: "أظافر",
      starts_at: "2030-01-02T10:00:00Z",
    },
  ]);
  const salons = await loadPublicSalons(client);
  assert.deepEqual(salons, [
    {
      organizationId: orgA,
      name: "صالون أ",
      nextStartsAt: "2030-01-01T10:00:00Z",
      services: ["قص", "صبغة"],
    },
    {
      organizationId: orgB,
      name: "صالون ب",
      nextStartsAt: "2030-01-02T10:00:00Z",
      services: ["أظافر"],
    },
  ]);
  assert.equal(client.calls[0].table, "glam_appointments");
  assert.match(client.calls[0].columns, /organization_id/);
});

test("conflicting names for one organization fail closed", async () => {
  const client = clientWith([
    {
      organization_id: orgA,
      salon_name: "صالون أ",
      service_name: "قص",
      starts_at: "2030-01-01T10:00:00Z",
    },
    {
      organization_id: orgA,
      salon_name: "اسم مختلف",
      service_name: "صبغة",
      starts_at: "2030-01-01T12:00:00Z",
    },
  ]);
  await assert.rejects(loadPublicSalons(client), /SALON_IDENTITY_CONFLICT/);
});

test("database errors never fall back to synthetic salon data", async () => {
  const error = { code: "42501" };
  await assert.rejects(loadPublicSalons(clientWith(null, error)), (value) => value === error);
});
