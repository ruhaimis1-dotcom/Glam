import assert from "node:assert/strict";
import test from "node:test";
import { createImportCommitRepository } from "../src/repositories/import-commit.ts";

function clientFor({ memberships = [], rpcResult = { data: null, error: null } } = {}) {
  let rpcCalls = 0;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "manager-1" } }, error: null }) },
    from(table) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () =>
          table === "glam_memberships"
            ? Promise.resolve({ data: memberships, error: null })
            : chain,
        order: () => Promise.resolve({ data: [{ id: "org-1", name: "صالون" }], error: null }),
      };
      return chain;
    },
    rpc: async () => {
      rpcCalls++;
      return rpcResult;
    },
    get rpcCalls() {
      return rpcCalls;
    },
  };
  return client;
}

test("unauthorized organization is rejected before import RPC", async () => {
  const client = clientFor({ memberships: [] });
  await assert.rejects(
    createImportCommitRepository(client).commit("org-1", "services", [
      { name: "قص", priceSar: 100, minutes: 30, active: true },
    ]),
    /FORBIDDEN/,
  );
  assert.equal(client.rpcCalls, 0);
});

test("missing import RPC fails closed", async () => {
  const client = clientFor({
    memberships: [{ organization_id: "org-1", role: "manager" }],
    rpcResult: { data: null, error: { code: "PGRST202" } },
  });
  await assert.rejects(
    createImportCommitRepository(client).commit("org-1", "services", [
      { name: "قص", priceSar: 100, minutes: 30, active: true },
    ]),
    /IMPORT_COMMIT_NOT_ENABLED/,
  );
});

test("zero or unconfirmed response is never reported as success", async () => {
  const client = clientFor({
    memberships: [{ organization_id: "org-1", role: "owner" }],
    rpcResult: { data: { accepted: 0, rejected: 0 }, error: null },
  });
  await assert.rejects(
    createImportCommitRepository(client).commit("org-1", "customers", [
      { name: "سارة", phone: "0500000000" },
    ]),
    /IMPORT_NOT_CONFIRMED/,
  );
});
