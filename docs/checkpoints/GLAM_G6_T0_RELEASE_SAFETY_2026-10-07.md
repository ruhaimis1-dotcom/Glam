# GLAM G6 — Production Database Release Safety / T0 Plan
Date: 2026-10-07
Project: GLAM
Candidate branch: `agent-os/mvp-gate-2026-10-06`

## Status

**PREPARED / PRODUCTION READ BLOCKED BY CONNECTOR PERMISSION**

No production DDL, DML, migration, merge, deploy, backup export, or credential rotation was performed while preparing this checkpoint.

Latest candidate Quality Gate observed before this checkpoint:
- Run #138: SUCCESS
- Candidate head before this checkpoint: `7dd6e7f8b495a8c89687219ca8b672cc27290e82`

G3/G4 evidence supplied from the isolated local rehearsal:
- G3/G4 migration rehearsal: PASS
- static schema/RLS/ACL/RPC assertions: PASS
- runtime authenticated tenant/customer isolation: PASS
- test transaction: ROLLBACK
- salon-side Beauty Passport read remains intentionally disabled in the MVP

## Production project expected

Previously documented GLAM Supabase project:
`tevqysdswqkgqartpzdg`

The connected Supabase MCP session currently exposes only another project (KFO).
A direct metadata read of `tevqysdswqkgqartpzdg` returned a permission error.
Therefore **no claim is made that the production schema was re-read on 2026-10-07**.

Do not substitute another Supabase project.

## G6 objectives

Before any production schema change:

1. re-read the current production schema, ACLs, RLS, functions, triggers and migration history;
2. compute the exact migration delta for the approved candidate;
3. create a current T0 recoverable export immediately before the migration window;
4. verify export integrity and restore it into a separate isolated PostgreSQL database;
5. compare protected counts/IDs from the same snapshot without publishing customer identifiers;
6. apply only the reviewed additive migrations after explicit production approval;
7. perform post-migration read/write smoke tests before reopening writes.

## Expected candidate migration delta

The G3/G4 files remain prepared-only until the live re-check confirms they are still absent and non-conflicting:

1. `docs/sql/mvp/20261006_000_g3_team_directory_compat.sql`
2. `docs/sql/mvp/20261006_001_beauty_passport_minimal.sql`
3. `docs/sql/mvp/20261006_002_client_360_minimal.sql`

Do not convert these into production migrations or apply them based only on the 2026-10-06 comparison.

Older PR4 migrations must also be compared against the live migration ledger before release:
1. `20260925205817_catalog_contract_and_visibility.sql`
2. `20260926150009_booking_catalog_visibility.sql`
3. `20260927141701_catalog_delivery_booking.sql`
4. `20260927155514_reservation_delivery_compatibility.sql`

Never use migration repair to make history look applied.

## T0 export requirements

The T0 artifact must be produced from GLAM production only after access is restored and immediately before the approved migration window.

Required scope:
- application schemas needed for GLAM restore;
- GLAM data required to preserve services, appointments, reservations, memberships and customer-owned MVP data;
- required Auth database objects/data needed for referential integrity, handled according to the supported Supabase dump/restore path;
- required roles/privileges without storing role passwords in source control;
- explicit documentation of what Supabase-managed components are excluded from the database export.

Storage objects/files, external Auth provider configuration, secrets and hosted platform settings are not proven recoverable merely by a PostgreSQL dump. They require a separate inventory/restore statement if used by the MVP.

## T0 handling rules

- Never commit production dump files, raw IDs, user rows, credentials, tokens or encryption passphrases.
- Keep the raw dump only in the approved local secure path.
- Encrypt the export before any off-machine copy.
- Record SHA-256 for the encrypted artifact and the source artifact if policy permits.
- Verify decryption before declaring the backup usable.
- Restore into a separate isolated database; never overwrite production for the rehearsal.
- Capture counts and ID-set comparison results from the same export snapshot.
- Public release evidence may contain counts and PASS/FAIL only, not customer identifiers.

## Minimum integrity evidence

Record privately for the T0 snapshot:
- services count and ID set;
- appointments count and ID set;
- reservations count and ID set;
- organizations/memberships counts;
- G4 tables if present after migration only, not before;
- migration ledger;
- relevant function/RLS/ACL/trigger catalog fingerprints.

After restore, compare exact ID sets and counts. A matching count alone is insufficient.

## Live read-only preflight queries

When production access is available, execute read-only queries only to confirm:

- current migration ledger;
- presence/absence of:
  - `glam_business_team_directory(uuid)`
  - `glam_beauty_passports`
  - `glam_passport_consents`
  - `glam_client_contacts`
  - G4 public/private RPC signatures;
- existing RLS policies and grants for touched relations/functions;
- no parallel `glam_staff`, `glam_staff_services`, or `glam_staff_availability` model;
- current table counts relevant to release;
- current trigger/function definitions touched by older PR4 migrations;
- current security advisor findings.

Any unexplained production drift stops the release.

## Restore acceptance

The T0 gate passes only when all are true:

1. export command exits successfully;
2. encrypted artifact exists and its hash is recorded;
3. decryption test succeeds;
4. restore to a fresh isolated database succeeds;
5. migration ledger is readable;
6. required schemas/functions/relations are present;
7. protected counts and exact ID sets match the source snapshot;
8. no production credentials or customer data are committed to Git;
9. restore steps are written and reproducible.

## Current blocker

Live read-only access is now available and the comparison is complete. The remaining G6 blocker is a current T0 export plus successful isolated restore/integrity proof. The export must run in an environment that can securely use the GLAM database credential without exposing it in chat or Git.

## Next safe action

Run the supported local T0 export from the approved local environment using a secure credential source, verify hashes/decryption, restore into a fresh isolated database, and compare exact protected ID sets/counts. Stop before any production migration and request a separate explicit production-write approval.


## Live production re-check — 2026-10-07

Supabase connector access to the exact GLAM project was restored and the following checks were executed read-only.

Project:
- ref: `tevqysdswqkgqartpzdg`
- status: ACTIVE_HEALTHY
- region: eu-central-1
- Postgres: 17.6.1.166
- organization plan: Free

Current migration ledger:
- latest recorded migration: `20260923214630_seed_initial_service_catalog_categories`
- none of the four reviewed PR4 migrations are recorded;
- none of the prepared G3/G4 files are production migrations or recorded as applied.

Current production counts observed:
- organizations: 4
- memberships: 2
- services: 5
- appointments: 37
- reservations: 6
- service-specialist links: 3
- schedule windows: 6

G3/G4 production absence confirmed:
- `public.glam_business_team_directory(uuid)`: absent
- `public.glam_beauty_passports`: absent
- `public.glam_passport_consents`: absent
- `public.glam_client_contacts`: absent
- G4 list/revoke/duplicate/create/timeline public RPCs: absent
- parallel `glam_staff` / `glam_staff_services` / `glam_staff_availability`: absent

PR4 marker check:
- `glam_reservations.delivery_channel`: absent
- `glam_00_booking_concurrency`: absent
- `glam_delivery_booking`: absent
- `catalog_*` policies: absent
- only the legacy public booking RPC signatures are present:
  - `glam_reserve(uuid,uuid)`
  - `glam_reserve_direct(text,uuid,uuid)`
  - `glam_reschedule(uuid,uuid,uuid)`

This supports an expected release delta of the four reviewed PR4 migrations followed by the three prepared G3/G4 changes, subject to conversion of the G3/G4 prepared SQL into formal migrations using the supported Supabase CLI workflow and a final pre-window live re-check. Nothing has been applied.

The previously documented `supabase_admin` public-schema default-privilege difference is still present in production for relations, functions and sequences. Do not silently normalize it as part of the MVP release.

### Security Advisor snapshot

Current production advisor findings:
- INFO: RLS enabled with no policy on six tables:
  - `glam_private.attendance_events`
  - `glam_private.platform_admins`
  - `glam_private.salon_approvals`
  - `glam_private.team_invites`
  - `public.glam_payment_webhook_events`
  - `public.glam_reviews`
- WARN: leaked password protection is disabled in Supabase Auth.

These findings pre-date the G3/G4 migration because those relations are absent in production. They require explicit review before the Human MVP Gate; do not change them automatically as part of the database release.

Supabase remediation references:
- RLS enabled/no policy: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- leaked password protection: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### Current T0 path

Current Supabase documentation confirms:
- Free projects should regularly create manual logical exports using `supabase db dump`;
- Storage API objects themselves are not contained in a database backup;
- a supported portable backup can be separated into roles, schema and data dumps.

The production database export itself has **not** been started from this agent session because the Supabase MCP exposes SQL/metadata operations, not a safe downloadable `db dump` artifact path. The T0 export must therefore run in the approved local environment using a secure connection string/password source that is not pasted into chat or committed.

G6 state after this re-check:
- live read-only comparison: PASS
- exact expected migration delta: IDENTIFIED, final pre-window re-check still required
- security advisor review: CAPTURED
- T0 export: NOT YET EXECUTED
- T0 restore/integrity proof: NOT YET EXECUTED
- production migration/write: NOT AUTHORIZED
