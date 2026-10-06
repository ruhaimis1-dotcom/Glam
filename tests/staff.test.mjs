import assert from "node:assert/strict";
import test from "node:test";
import { inviteStaff, listStaff } from "../src/repositories/staff.ts";

function fixture({
  memberships = [{ organization_id: "org-a", role: "manager" }],
  directory = [
    { organization_id: "org-a", user_id: "specialist-a", display_name: "سارة", role: "specialist" },
    { organization_id: "org-a", user_id: "manager-a", display_name: "المديرة", role: "manager" },
    { organization_id: "org-b", user_id: "specialist-b", display_name: "ريم", role: "specialist" },
  ],
} = {}) {
  const calls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "manager" } }, error: null }) },
    from(table) {
      const call = { table, filters: [] };
      calls.push(call);
      const chain = {
        select() {
          return chain;
        },
        eq(column, value) {
          call.filters.push([column, value]);
          return chain;
        },
        in(column, values) {
          call.filters.push([column, values]);
          if (table === "glam_memberships")
            return Promise.resolve({ data: memberships, error: null });
          return chain;
        },
        order() {
          return chain;
        },
        then(resolve, reject) {
          if (table === "glam_organizations") {
            return Promise.resolve({ data: [{ id: "org-a", name: "صالون أ" }], error: null }).then(
              resolve,
              reject,
            );
          }
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        },
      };
      return chain;
    },
    async rpc(name, args) {
      calls.push({ rpc: name, args });
      if (name === "glam_business_team_directory") return { data: directory, error: null };
      if (name === "glam_create_team_invite") return { data: "invite-1", error: null };
      return { data: null, error: { code: "PGRST202" } };
    },
  };
  return { client, calls };
}

test("staff directory exposes only specialists from the authorized organization", async () => {
  const f = fixture();
  const rows = await listStaff(f.client, "org-a");
  assert.deepEqual(
    rows.map((row) => [row.id, row.organization_id, row.name]),
    [["specialist-a", "org-a", "سارة"]],
  );
  const rpc = f.calls.find((call) => call.rpc === "glam_business_team_directory");
  assert.deepEqual(rpc.args, { p_org: "org-a" });
});

test("staff directory rejects a forged organization before RPC", async () => {
  const f = fixture();
  await assert.rejects(listStaff(f.client, "org-b"), /FORBIDDEN/);
  assert.equal(
    f.calls.some((call) => call.rpc === "glam_business_team_directory"),
    false,
  );
});

test("staff invite always requests specialist role for the authorized organization", async () => {
  const f = fixture();
  const id = await inviteStaff(f.client, "org-a", " TEST@EXAMPLE.COM ");
  assert.equal(id, "invite-1");
  const rpc = f.calls.find((call) => call.rpc === "glam_create_team_invite");
  assert.deepEqual(rpc.args, {
    p_org: "org-a",
    p_email: "test@example.com",
    p_role: "specialist",
  });
});

test("staff invite rejects forged organization before RPC", async () => {
  const f = fixture();
  await assert.rejects(inviteStaff(f.client, "org-b", "a@example.com"), /FORBIDDEN/);
  assert.equal(
    f.calls.some((call) => call.rpc === "glam_create_team_invite"),
    false,
  );
});
