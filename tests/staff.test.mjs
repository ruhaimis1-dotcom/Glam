import assert from "node:assert/strict";
import test from "node:test";
import { createStaff, listStaff, setStaffActive } from "../src/repositories/staff.ts";

function fixture({ memberships = [{ organization_id: "org-a", role: "manager" }] } = {}) {
  const calls = [];
  const staff = [
    {
      id: "staff-a",
      organization_id: "org-a",
      name: "سارة",
      specialty: "شعر",
      phone: null,
      active: true,
    },
    {
      id: "staff-b",
      organization_id: "org-b",
      name: "ريم",
      specialty: "أظافر",
      phone: null,
      active: true,
    },
  ];

  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "manager" } }, error: null }) },
    from(table) {
      const call = { table, filters: [] };
      calls.push(call);
      let inserted = null;
      let updated = null;
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
          if (table === "glam_memberships") {
            return Promise.resolve({ data: memberships, error: null });
          }
          return chain;
        },
        order() {
          if (table === "glam_organizations") {
            return Promise.resolve({ data: [{ id: "org-a", name: "صالون أ" }], error: null });
          }
          if (table === "glam_staff") {
            const org = call.filters.find(([column]) => column === "organization_id")?.[1];
            return Promise.resolve({
              data: staff.filter((row) => row.organization_id === org),
              error: null,
            });
          }
          return chain;
        },
        insert(value) {
          inserted = value;
          call.inserted = value;
          return chain;
        },
        update(value) {
          updated = value;
          call.updated = value;
          return chain;
        },
        single() {
          if (inserted) {
            return Promise.resolve({
              data: {
                id: "staff-new",
                active: true,
                ...inserted,
              },
              error: null,
            });
          }
          if (updated) {
            const org = call.filters.find(([column]) => column === "organization_id")?.[1];
            const id = call.filters.find(([column]) => column === "id")?.[1];
            const row = staff.find((item) => item.organization_id === org && item.id === id);
            return Promise.resolve({
              data: row ? { ...row, ...updated } : null,
              error: row ? null : { code: "PGRST116" },
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
      };
      return chain;
    },
  };
  return { client, calls };
}

test("staff reads are scoped to the selected authorized organization", async () => {
  const f = fixture();
  const rows = await listStaff(f.client, "org-a");
  assert.deepEqual(rows.map((row) => row.id), ["staff-a"]);
  const staffRead = f.calls.find((call) => call.table === "glam_staff");
  assert.deepEqual(staffRead.filters[0], ["organization_id", "org-a"]);
});

test("staff creation rejects a forged organization before write", async () => {
  const f = fixture();
  await assert.rejects(
    createStaff(f.client, "org-b", { name: "نورة", specialty: "مكياج" }),
    /FORBIDDEN/,
  );
  assert.equal(f.calls.some((call) => call.table === "glam_staff" && call.inserted), false);
});

test("staff creation always writes the authorized organization id", async () => {
  const f = fixture();
  const row = await createStaff(f.client, "org-a", {
    name: " نورة ",
    specialty: " مكياج ",
    phone: " 0500000000 ",
  });
  assert.equal(row.organization_id, "org-a");
  const write = f.calls.find((call) => call.table === "glam_staff" && call.inserted);
  assert.equal(write.inserted.organization_id, "org-a");
  assert.equal(write.inserted.name, "نورة");
});

test("staff status update requires organization and staff id together", async () => {
  const f = fixture();
  const row = await setStaffActive(f.client, "org-a", "staff-a", false);
  assert.equal(row.active, false);
  const write = f.calls.find((call) => call.table === "glam_staff" && call.updated);
  assert.deepEqual(
    write.filters.filter(([column]) => column === "organization_id" || column === "id"),
    [
      ["organization_id", "org-a"],
      ["id", "staff-a"],
    ],
  );
});
