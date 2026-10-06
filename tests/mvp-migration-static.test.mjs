import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../docs/sql/mvp/", import.meta.url);

async function sql(name) {
  return readFile(new URL(name, root), "utf8");
}

test("G3 candidate reuses the live staff architecture and adds no parallel staff tables", async () => {
  const source = await sql("20261006_000_g3_team_directory_compat.sql");
  assert.match(source, /glam_business_team_directory/);
  assert.match(source, /m\.role in \('owner','manager','specialist'\)/);
  assert.doesNotMatch(source, /create table\s+public\.glam_(staff|staff_services|staff_availability)/i);
  assert.match(source, /security definer/i);
  assert.match(source, /set search_path = ''/i);
  assert.match(
    source,
    /revoke all on function glam_private\.business_team_directory\(uuid\) from public, anon/i,
  );
});

test("Beauty Passport candidate remains customer-owned and consent access is RPC-only", async () => {
  const source = await sql("20261006_001_beauty_passport_minimal.sql");
  assert.match(source, /alter table public\.glam_beauty_passports enable row level security/i);
  assert.match(source, /customer_id = \(select auth\.uid\(\)\)/i);
  assert.match(source, /alter table public\.glam_passport_consents enable row level security/i);
  assert.match(
    source,
    /revoke all on public\.glam_passport_consents from anon, authenticated/i,
  );
  assert.match(source, /glam_my_passport_consents/);
  assert.match(source, /glam_revoke_passport_consent/);
  assert.doesNotMatch(source, /grant\s+select[^;]*glam_passport_consents[^;]*authenticated/i);
  assert.doesNotMatch(source, /salon[^\n]*select[^\n]*glam_beauty_passports/i);
});

test("Client 360 candidate is organization-scoped and keeps deferred CRM tables out", async () => {
  const source = await sql("20261006_002_client_360_minimal.sql");
  assert.match(source, /create table public\.glam_client_contacts/i);
  assert.match(source, /alter table public\.glam_client_contacts enable row level security/i);
  assert.match(source, /m\.role in \('owner','manager'\)/);
  assert.match(source, /glam_find_client_contact_duplicates/);
  assert.match(source, /glam_create_client_contact/);
  assert.match(source, /glam_client_timeline/);
  for (const deferred of [
    "glam_client_notes",
    "glam_client_tags",
    "glam_client_followups",
    "glam_client_communications",
  ]) {
    assert.doesNotMatch(source, new RegExp(`create table public\\.${deferred}`, "i"));
  }
});

test("all private SECURITY DEFINER candidates explicitly restrict execution", async () => {
  const sources = await Promise.all([
    sql("20261006_000_g3_team_directory_compat.sql"),
    sql("20261006_001_beauty_passport_minimal.sql"),
    sql("20261006_002_client_360_minimal.sql"),
  ]);
  const combined = sources.join("\n");
  for (const signature of [
    "business_team_directory\\(uuid\\)",
    "my_passport_consents\\(\\)",
    "revoke_passport_consent\\(uuid\\)",
    "find_client_contact_duplicates\\(uuid,text,text\\)",
    "create_client_contact\\(uuid,text,text,text\\)",
    "client_timeline\\(uuid,uuid\\)",
  ]) {
    assert.match(
      combined,
      new RegExp(`revoke all on function glam_private\\.${signature} from public, anon`, "i"),
    );
  }
});
