import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

// Text-level regression guards only. These do NOT parse/execute PostgreSQL or
// certify RLS. The real role/ACL regression lives in supabase/tests/catalog_contract.sql.
const directory = new URL("../supabase/migrations/", import.meta.url);
const filename = "20260925205817_catalog_contract_and_visibility.sql";
const sql = readFileSync(new URL(filename, directory), "utf8")
  .replace(/--[^\n]*/g, "")
  .replace(/\s+/g, " ")
  .toLowerCase();

test("anonymous subcategory reads narrow the verified legacy PUBLIC policy before grants", () => {
  const baseline = JSON.parse(
    readFileSync(
      new URL(
        "../docs/architecture/evidence/PR4_2026_09_26_catalog_metadata.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const policy = baseline.policies.find(
    (p) => p.policyname === "service_subcategories_managed_by_business_members",
  );
  assert.equal(policy.roles, "{public}");
  assert.equal(policy.cmd, "ALL");
  assert.match(policy.qual, /glam_memberships/);
  assert.equal(
    baseline.table_acl.find((a) => a.relname === "glam_memberships" && a.rolname === "anon").sel,
    false,
  );
  const correction = sql.indexOf(
    "alter policy service_subcategories_managed_by_business_members on public.glam_service_subcategories to authenticated;",
  );
  assert.ok(correction >= 0, "live ALL/PUBLIC management policy must not apply to anon");
  assert.ok(correction < sql.indexOf("grant select on table"));
  assert.doesNotMatch(sql, /grant [^;]*on (?:table )?public\.glam_memberships[^;]*to [^;]*anon/);
});

test("all catalog writer signatures revoke PUBLIC/anon execution and grant authenticated", () => {
  const signatures = [
    "save_catalog_service(uuid,uuid,text,integer,numeric,boolean,uuid,uuid,text,integer)",
    "delete_catalog_service(uuid,uuid)",
    "save_catalog_category(uuid,uuid,text,uuid)",
    "delete_catalog_category(uuid,uuid,boolean)",
  ];
  const statements = sql.split(";").map((statement) => statement.trim());
  for (const signature of signatures) {
    for (const prefix of ["public.glam_", "glam_private."]) {
      const name = prefix + signature;
      assert.ok(
        statements.some(
          (s) =>
            s.startsWith("revoke all on function ") &&
            s.includes(name) &&
            s.endsWith(" from public,anon,authenticated"),
        ),
        name,
      );
      assert.ok(
        statements.some(
          (s) =>
            s.startsWith("grant execute on function ") &&
            s.includes(name) &&
            s.endsWith(" to authenticated"),
        ),
        name,
      );
      assert.ok(
        !statements.some(
          (s) =>
            s.startsWith("grant execute on function ") &&
            s.includes(name) &&
            /to .*\b(?:anon|public)\b/.test(s),
        ),
        name,
      );
    }
  }
});

test("only the prepared live-baseline migration is runnable; historical SQL is archived", () => {
  assert.deepEqual(
    readdirSync(directory).filter((file) => file.endsWith(".sql")),
    [filename],
  );
  assert.match(
    readFileSync(
      new URL("../docs/sql/archive/20260923_001_service_intelligence.sql", import.meta.url),
      "utf8",
    ),
    /ARCHIVED PROPOSAL ONLY/,
  );
  assert.ok(sql.startsWith(" begin;"));
  assert.ok(sql.trimEnd().endsWith("commit;"));
  assert.ok(
    sql.indexOf("glam_categories_org_id_unique unique") <
      sql.indexOf("glam_subcategories_tenant_parent_fk foreign key"),
  );
});
