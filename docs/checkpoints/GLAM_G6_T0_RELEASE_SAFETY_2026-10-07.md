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

The current Supabase connector account cannot read project `tevqysdswqkgqartpzdg`.
Until access to that exact GLAM project is restored, G6 remains **BLOCKED BEFORE LIVE READ**.

Do not use KFO or another project as a substitute and do not request or paste database passwords into chat.

## Next safe action

Restore connector access to the GLAM Supabase project, or use the already-authorized local environment with an existing secure database credential file/path that is never pasted into chat.

Once access is available:
1. perform the live read-only comparison;
2. prepare the exact T0 export command for the environment actually available;
3. execute T0 only under the existing explicit authorization for this G6 task if no new paid service/cost is introduced;
4. stop before any production migration and request a separate explicit production-write approval.
