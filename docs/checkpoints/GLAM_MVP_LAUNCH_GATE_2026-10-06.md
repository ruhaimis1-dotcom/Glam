# GLAM MVP Launch Gate — 2026-10-06

Status: **NO DEPLOY — HUMAN MVP GATE NOT CLOSED**

## Purpose
Create one release decision point from the latest documented GLAM development state without repeating completed work or making backup/Docker the primary blocker.

## Release baseline
- Base branch: `agent-os/p4-client-360`
- Gate branch: `agent-os/mvp-gate-2026-10-06`
- `main` is not the release source yet.
- No production migrations, no main merge, no Vercel production release, and no production write changes are authorized by this document.

## Evidence already accepted
1. P3 automated Quality Gate: GREEN at commit `e27feaf40d391cf1048ca4937364ff93363f371f`.
2. P3 negative Security Gate: GREEN at commit `9d80f8da6be8105db6d0083307bf2c7b018cab58`.
3. Previous local booking/catalog browser checks passed on desktop + Pixel 7 simulation.
4. Production PR4 migrations were not applied at the last documented review.
5. The encrypted 30 September archive proved a restore path for the tested data scope, but is not a current T0 restore point.

## Do not repeat
- Do not retry the failed `docker cp` migration-copy path. The stdin-to-psql path already bypassed it successfully.
- Do not repeat completed P3 Quality/Security tests unless relevant code changes invalidate their evidence.
- Do not describe mock/static screens as production capability.
- Do not merge development branches directly into `main` before this gate closes.

## MVP critical path

### G1 — Development source consolidation
**Current:** AMBER

Pass criteria:
- confirm `agent-os/p4-client-360` contains the intended P1.2/P1.3/P2/P3/P4 chain;
- identify any required commits still stranded on older divergent UAT branches;
- no duplicate legacy implementation is reintroduced.

### G2 — Core customer booking journey
**Current:** AMBER

Required evidence:
- real Auth sign-in/sign-up path;
- salon/service discovery from non-fabricated persisted data;
- service -> date/time -> staff/availability -> booking;
- booking appears in customer bookings after persistence;
- failure/retry and account isolation remain correct;
- mobile + desktop verification on the candidate release build.

Payment:
- must either be proven end-to-end for release, or explicitly removed from the MVP promise/flow until integrated.
- a UI payment selector alone does not satisfy the gate.

### G3 — Salon operations
**Current:** AMBER

Required evidence:
- authenticated salon/business access;
- persisted services and delivery channel;
- persisted staff members and staff-service assignment;
- schedule/booking visibility scoped to the correct organization;
- booking status updates persist;
- no React-only/mock state used for a capability presented as live.

### G4 — Privacy / tenant isolation
**Current:** AMBER

Required evidence:
- organization isolation for salon data;
- customer ownership/isolation for personal profile/bookings;
- Beauty Passport data is exposed to a salon only through explicit consented scopes;
- consent revocation and fail-closed behavior tested where P2/P4 expose passport data;
- no tenant identifiers can be injected through import payloads.

### G5 — Import pipeline
**Current:** GREEN FOR DEVELOPMENT / OPTIONAL FOR LAUNCH

P3 Quality + Security evidence is green.
For MVP release this feature may remain disabled if production RPC/migrations are not intentionally enabled and the UI does not claim live import capability.

### G6 — Production database release safety
**Current:** RED

Required before production schema change:
- current production schema/ACL/function/trigger comparison;
- identify exact production migration delta;
- create a current T0 recoverable export immediately before the migration window using a proven path;
- document the restore command/path and verify artifact integrity;
- apply only reviewed additive migrations in order;
- post-migration read + write verification.

Important:
Supabase Free Plan lacking managed Project Backups does **not** require blocking the entire MVP indefinitely. It means the project needs an explicit application-managed T0 export/restore path before production schema changes.

### G7 — UI/brand/mobile release review
**Current:** AMBER

Required:
- approved GLAM visual identity only;
- no HEXA identity in customer-facing UI;
- no unapproved AI-looking imagery where the design direction rejected it;
- full customer and salon critical paths checked on mobile + desktop;
- loading/empty/offline/payment-failure/cancel states remain usable.

### G8 — Human MVP Gate
**Current:** RED

Saud review must receive:
- one candidate URL or local candidate build clearly marked;
- test account roles;
- exact features included in MVP;
- known exclusions;
- Quality/Security/UAT evidence summary;
- production migration plan and rollback/T0 evidence.

Release requires explicit approval after this package is reviewed.

## Deferred without blocking MVP unless explicitly re-scoped
- POS;
- inventory;
- accounting;
- advanced loyalty growth mechanics;
- advanced integrations not required for the booking loop;
- full advanced CRM automation beyond the Client 360 essentials.

## Next engineering action
1. Audit the P4 branch ancestry against P1.2/P1.3/P2/P3 and divergent booking UAT branches.
2. Produce the exact candidate source set.
3. Run only the delta Quality Gate needed for the candidate.
4. Close G2/G3/G4 on a non-production candidate environment.
5. Prepare G6 T0 + migration runbook only after candidate functionality is green.
6. Present the Human MVP Gate package to Saud.
