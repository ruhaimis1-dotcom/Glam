import assert from "node:assert/strict";
import test from "node:test";
import { createClient360Repository } from "../src/repositories/client-360.ts";

function clientFor({ memberships = [], rpc } = {}) {
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
        order: () =>
          Promise.resolve(
            table === "glam_organizations"
              ? { data: [{ id: "org-1", name: "صالون" }], error: null }
              : { data: [], error: null },
          ),
      };
      return chain;
    },
    rpc: async (name, args) => {
      rpcCalls++;
      return rpc ? rpc(name, args) : { data: null, error: { code: "PGRST202" } };
    },
    get rpcCalls() {
      return rpcCalls;
    },
  };
  return client;
}

const member = [{ organization_id: "org-1", role: "manager" }];

test("Client 360 rejects another organization before any RPC", async () => {
  const client = clientFor({ memberships: member });
  await assert.rejects(
    createClient360Repository(client).create("org-2", {
      displayName: "عميلة",
      phone: "0500000000",
    }),
    /FORBIDDEN/,
  );
  assert.equal(client.rpcCalls, 0);
});

test("duplicate signals are scoped to the authorized organization", async () => {
  let received;
  const client = clientFor({
    memberships: member,
    rpc: async (_name, args) => {
      received = args;
      return { data: [], error: null };
    },
  });
  await createClient360Repository(client).findDuplicateSignals("org-1", {
    displayName: "عميلة",
    email: " TEST@EXAMPLE.COM ",
  });
  assert.equal(received.p_org, "org-1");
  assert.equal(received.p_email, "test@example.com");
});

test("contact creation requires a phone or email", async () => {
  const client = clientFor({ memberships: member });
  await assert.rejects(
    createClient360Repository(client).create("org-1", { displayName: "عميلة" }),
    /CONTACT_CHANNEL_REQUIRED/,
  );
  assert.equal(client.rpcCalls, 0);
});

test("missing Client 360 RPC fails closed", async () => {
  const client = clientFor({ memberships: member });
  await assert.rejects(
    createClient360Repository(client).create("org-1", {
      displayName: "عميلة",
      phone: "0500000000",
    }),
    /CLIENT_360_NOT_ENABLED/,
  );
});

test("duplicate detection does not use name as a global identity signal", async () => {
  const client = clientFor({ memberships: member });
  const result = await createClient360Repository(client).findDuplicateSignals("org-1", {
    displayName: "اسم متكرر",
  });
  assert.deepEqual(result, []);
  assert.equal(client.rpcCalls, 0);
});
