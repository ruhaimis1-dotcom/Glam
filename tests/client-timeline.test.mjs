import assert from "node:assert/strict";
import test from "node:test";
import { createClientTimelineRepository } from "../src/repositories/client-timeline.ts";

function clientFor({ memberships = [], rpcResult = { data: [], error: null } } = {}) {
  let rpcCalls = 0;
  let rpcArgs;
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
        order: () =>
          Promise.resolve(
            table === "glam_organizations"
              ? { data: [{ id: "org-1", name: "صالون" }], error: null }
              : { data: [], error: null },
          ),
      };
      return chain;
    },
    rpc: async (_name, args) => {
      rpcCalls++;
      rpcArgs = args;
      return rpcResult;
    },
    get rpcCalls() {
      return rpcCalls;
    },
    get rpcArgs() {
      return rpcArgs;
    },
  };
  return client;
}

test("timeline rejects unauthorized organization before RPC", async () => {
  const client = clientFor({ memberships: [] });
  await assert.rejects(
    createClientTimelineRepository(client).list("org-1", "contact-1"),
    /FORBIDDEN/,
  );
  assert.equal(client.rpcCalls, 0);
});

test("timeline passes both authorized organization and contact to server contract", async () => {
  const client = clientFor({
    memberships: [{ organization_id: "org-1", role: "manager" }],
  });
  await createClientTimelineRepository(client).list("org-1", "contact-1");
  assert.deepEqual(client.rpcArgs, { p_org: "org-1", p_contact: "contact-1" });
});

test("timeline fails closed while reviewed RPC is not enabled", async () => {
  const client = clientFor({
    memberships: [{ organization_id: "org-1", role: "owner" }],
    rpcResult: { data: null, error: { code: "PGRST202" } },
  });
  await assert.rejects(
    createClientTimelineRepository(client).list("org-1", "contact-1"),
    /CLIENT_360_NOT_ENABLED/,
  );
});
