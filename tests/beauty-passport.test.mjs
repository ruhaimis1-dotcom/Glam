import assert from "node:assert/strict";
import test from "node:test";
import { createBeautyPassportRepository } from "../src/repositories/beauty-passport.ts";
import { createPassportConsentRepository } from "../src/repositories/passport-consent.ts";

function query(result) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () => Promise.resolve(result),
    single: () => Promise.resolve(result),
    upsert: () => chain,
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

test("consent list uses customer-only RPC after authenticating", async () => {
  const calls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "customer-a" } }, error: null }) },
    rpc: async (name, args) => {
      calls.push([name, args]);
      return {
        data: [{
          id: "consent-1",
          organization_id: "org-a",
          organization_name: "صالون أ",
          scopes: ["profile", "photos"],
          granted_at: "2030-01-01T10:00:00Z",
          expires_at: null,
        }],
        error: null,
      };
    },
  };
  const result = await createPassportConsentRepository(client).list();
  assert.deepEqual(calls, [["glam_my_passport_consents", undefined]]);
  assert.equal(result[0].organizationName, "صالون أ");
  assert.deepEqual(result[0].scopes, ["profile", "photos"]);
});

test("consent revoke uses reviewed RPC with only the consent id", async () => {
  const calls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "customer-a" } }, error: null }) },
    rpc: async (name, args) => {
      calls.push([name, args]);
      return { data: "consent-1", error: null };
    },
  };
  await createPassportConsentRepository(client).revoke("consent-1");
  assert.deepEqual(calls, [["glam_revoke_passport_consent", { p_id: "consent-1" }]]);
});

test("missing consent RPC fails closed", async () => {
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "customer-a" } }, error: null }) },
    rpc: async () => ({ data: null, error: { code: "PGRST202" } }),
  };
  await assert.rejects(createPassportConsentRepository(client).list(), /CONSENT_NOT_ENABLED/);
});

test("photos are a separate explicit consent scope", async () => {
  const source = await import("../src/repositories/passport-consent.ts");
  assert.ok(source.PASSPORT_SCOPES.includes("photos"));
  assert.notEqual(
    source.PASSPORT_SCOPES.indexOf("photos"),
    source.PASSPORT_SCOPES.indexOf("profile"),
  );
});
