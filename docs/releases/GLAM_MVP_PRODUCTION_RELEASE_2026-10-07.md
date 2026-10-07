# GLAM MVP Production Release Package — 2026-10-07

Status: **PREPARED — NO PRODUCTION WRITE AUTHORIZED**

## Candidate

- Branch: `agent-os/mvp-gate-2026-10-06`
- PR: #8
- Human MVP decision: GO for the approved MVP scope.
- Production project ref: `tevqysdswqkgqartpzdg`
- `main` is not the release source until the separate merge/deploy approval is given.

## Approved MVP scope

Included:
- Supabase Auth sign-in/sign-up.
- persisted salon/service discovery and appointment availability.
- service/category management.
- delivery channels: salon / home / both.
- booking persistence and customer booking list.
- customer profile persistence.
- salon/business access scoped by organization.
- team directory compatibility layer over existing memberships.
- minimal Client 360 contacts + duplicate/create RPC + booking timeline.
- customer-owned Beauty Passport and customer consent list/revoke contract.
- desktop/mobile loading, empty, error and retry behavior.

Explicit exclusions:
- booking cancellation.
- booking rescheduling.
- payment.
- complete central Admin.
- salon-side Beauty Passport read.
- advanced CRM notes/tags/follow-ups/communications.
- POS, inventory, accounting and advanced loyalty.

## Evidence accepted before release preparation

- Quality Gate: GREEN.
- G3/G4 isolated schema/security rehearsal: PASS.
- G3/G4 authenticated runtime tenant/customer isolation: PASS.
- G7 browser release review: 26/26 PASS, 0 coverage gaps, desktop + mobile.
- Application T0 encrypted export and isolated restore: PASS for the documented application-data scope.
- Production preflight was read-only and showed PR4 + G3/G4 absent at the time of inspection.

## Exact production migration order

The release candidate expects these seven migrations in this exact order:

1. `20260925205817_catalog_contract_and_visibility.sql`
2. `20260926150009_booking_catalog_visibility.sql`
3. `20260927141701_catalog_delivery_booking.sql`
4. `20260927155514_reservation_delivery_compatibility.sql`
5. `20261007180000_g3_team_directory_compat.sql`
6. `20261007180100_beauty_passport_minimal.sql`
7. `20261007180200_client_360_minimal.sql`

The last three are byte-for-byte copies of the rehearsed SQL under `docs/sql/mvp/`; only their formal migration filenames differ.

## Production window — mandatory sequence

### 0. Human write gate

STOP unless Saud has explicitly authorized production database writes for this release window.

That approval is separate from MVP GO and separate from preparation of this package.

### 1. Freeze the candidate

- record the exact PR head SHA;
- do not add features after the final browser/quality evidence;
- if release-affecting code changes, reopen the affected gate.

### 2. Final read-only drift check

Immediately before the window, verify:
- project ref is still `tevqysdswqkgqartpzdg`;
- migration ledger still does not contain the seven pending migrations unexpectedly;
- expected live tables/functions/triggers remain at the reviewed baseline;
- no unexpected migration or release occurred after the prior G6 preflight.

If drift exists: STOP and reconcile; do not push migrations.

### 3. Fresh T0

Take a new encrypted Application T0 immediately before the migration window using:

```powershell
.\scripts\export-glam-t0.ps1
```

Do not reuse the rehearsal T0 as the final release restore point.

Verify the encrypted artifact sidecar and retain the encrypted artifact.

Known scope:
- this Application T0 is not a full hosted Supabase disaster-recovery backup;
- managed Auth/Storage coverage and Storage objects remain outside the proven restore scope;
- Auth/Storage are not modified by the prepared G3/G4 migrations.

### 4. Verify final T0 restore procedure

The restore procedure has already been proven locally. If the final T0 differs unexpectedly or integrity verification fails: STOP.

Do not delete the encrypted T0 artifact.

### 5. Dry-run / migration-list review

Before any push:
- confirm the CLI is pointed at GLAM, not another project;
- inspect linked migration state;
- confirm only the seven migrations above are pending.

If any other migration is pending: STOP.

### 6. Apply migrations

Apply only after explicit production-write approval.

Do not manually paste partial statements into the SQL editor.
Do not skip a migration in the ordered chain.
Do not modify production default privileges as part of this release unless separately reviewed and authorized.

### 7. Immediate post-migration verification

Read checks:
- seven migrations recorded in the migration ledger;
- service/catalog reads succeed;
- public salon discovery succeeds;
- business team directory RPC exists;
- Beauty Passport customer tables/RPCs exist;
- Client 360 contact/RPC layer exists;
- no parallel `glam_staff*` model exists.

Write smoke checks must use controlled test identities/data only:
- owner/manager can save a service and delivery channel;
- customer can persist one test booking;
- account/organization isolation remains enforced;
- customer Passport save/list/revoke path works within the approved customer-only scope;
- Client 360 create/duplicate/timeline path works for the approved minimal scope.

Remove or clearly mark any smoke-test records according to the release procedure.

### 8. Application deploy

Deployment is a separate human gate after database verification.

Do not deploy a build that does not point to the verified GLAM production project.

### 9. Post-deploy smoke

Minimum:
- home/discovery.
- login.
- salon page.
- service -> channel -> date/time -> booking.
- bookings list.
- profile save/read.
- business login.
- services read/save.
- mobile viewport sanity.

### 10. Release decision

Mark release GREEN only if database verification and post-deploy smoke are both PASS.

## Stop conditions

Stop immediately if:
- project ref does not match GLAM;
- unexpected migrations are pending/applied;
- fresh T0 fails;
- migration fails or is partially applied;
- cross-tenant/customer isolation fails;
- booking persistence fails;
- production app points to the wrong Supabase project;
- any destructive schema change appears that was not part of the reviewed seven-file set.

## Rollback / recovery posture

Prefer forward-fix for additive schema/function defects where safe.

For application data corruption, the encrypted fresh T0 is the proven application-data recovery point.

Do not claim full Supabase disaster recovery from Application T0 because Auth/Storage managed data/object coverage is outside the proven scope.

No destructive rollback SQL is pre-authorized.

## Human approvals still required

1. production database write/migration approval;
2. merge/deploy approval after migration verification.

Nothing in this package grants either approval.
