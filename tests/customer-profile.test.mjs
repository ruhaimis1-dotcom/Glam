import test from "node:test";
import assert from "node:assert/strict";
import { createCustomerProfileRepository } from "../src/repositories/customer-profile.ts";
function fixture({
  user = { id: "a" },
  existing = true,
  readError = null,
  saved = { user_id: "a", display_name: "سارة" },
} = {}) {
  const writes = [],
    filters = [];
  const query = {
    select: () => ({ single: async () => ({ data: saved, error: null }) }),
    eq: (key, value) => {
      filters.push([key, value]);
      return query;
    },
  };
  const client = {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from: (table) => {
      assert.equal(table, "glam_profiles");
      return {
        select: () => ({
          eq: (key, value) => {
            filters.push([key, value]);
            return {
              maybeSingle: async () => ({
                data: existing ? { user_id: "a", display_name: "سارة" } : null,
                error: readError,
              }),
            };
          },
        }),
        update: (payload) => {
          writes.push(["update", payload]);
          return query;
        },
        insert: (payload) => {
          writes.push(["insert", payload]);
          return query;
        },
      };
    },
  };
  return { repository: createCustomerProfileRepository(client), writes, filters };
}
test("profile update changes name only and filters current user", async () => {
  const f = fixture();
  assert.equal((await f.repository.save("a", " سارة ")).displayName, "سارة");
  assert.deepEqual(f.writes, [["update", { display_name: "سارة" }]]);
  assert.deepEqual(f.filters, [
    ["user_id", "a"],
    ["user_id", "a"],
  ]);
});
test("new profile is inserted for current user only", async () => {
  const f = fixture({ existing: false });
  await f.repository.save("a", "سارة");
  assert.deepEqual(f.writes, [["insert", { user_id: "a", display_name: "سارة" }]]);
});
test("anonymous and switched accounts cannot save old profile", async () => {
  for (const user of [null, { id: "b" }]) {
    const f = fixture({ user });
    await assert.rejects(f.repository.save("a", "سارة"));
    assert.equal(f.writes.length, 0);
  }
});
test("failed lookup never becomes a new profile write", async () => {
  const f = fixture({ readError: Error("denied") });
  await assert.rejects(f.repository.save("a", "سارة"));
  assert.equal(f.writes.length, 0);
});
test("blank names and unconfirmed writes are rejected", async () => {
  const f = fixture({ saved: null });
  await assert.rejects(f.repository.save("a", " "));
  await assert.rejects(f.repository.save("a", "سارة"), /WRITE_NOT_CONFIRMED/);
});
