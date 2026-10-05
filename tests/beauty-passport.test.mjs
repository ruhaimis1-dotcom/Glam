import assert from "node:assert/strict";
import test from "node:test";
import { createBeautyPassportRepository } from "../src/repositories/beauty-passport.ts";
import { createPassportConsentRepository } from "../src/repositories/passport-consent.ts";

function query(result) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    order: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    single: () => Promise.resolve(result),
    upsert: () => chain,
    update: () => chain,
  };
  return chain;
}

test("passport save rejects a switched account before any write", async () => {
  let writes = 0;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "customer-b" } }, error: null }) },
    from: () => {
      writes++;
      return query({ data: null, error: null });
    },
  };
  const repository = createBeautyPassportRepository(client);
  await assert.rejects(
    repository.save({
      customerId: "customer-a",
      hair: {},
      skin: {},
      nails: {},
      sensitivities: [],
      preferences: {},
      customerNotes: "",
    }),
    /AUTH_REQUIRED/,
  );
  assert.equal(writes, 0);
});

test("consent list is always filtered to the signed-in customer", async () => {
  const filters = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "customer-a" } }, error: null }) },
    from: () => {
      const chain = query({ data: [], error: null });
      chain.eq = (column, value) => {
        filters.push([column, value]);
        return chain;
      };
      return chain;
    },
  };
  await createPassportConsentRepository(client).list();
  assert.deepEqual(filters[0], ["customer_id", "customer-a"]);
});

test("consent revoke requires both consent id and current customer id", async () => {
  const filters = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "customer-a" } }, error: null }) },
    from: () => {
      const chain = query({ data: { id: "consent-1" }, error: null });
      chain.eq = (column, value) => {
        filters.push([column, value]);
        return chain;
      };
      return chain;
    },
  };
  await createPassportConsentRepository(client).revoke("consent-1");
  assert.deepEqual(filters, [
    ["id", "consent-1"],
    ["customer_id", "customer-a"],
  ]);
});

test("photos are a separate explicit consent scope", async () => {
  const source = await import("../src/repositories/passport-consent.ts");
  assert.ok(source.PASSPORT_SCOPES.includes("photos"));
  assert.notEqual(source.PASSPORT_SCOPES.indexOf("photos"), source.PASSPORT_SCOPES.indexOf("profile"));
});
