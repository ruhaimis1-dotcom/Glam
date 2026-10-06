# GLAM G3/G4 Live Comparison & Minimal Migration Set — 2026-10-06

## Candidate
Branch: `agent-os/mvp-gate-2026-10-06`
Commit: `20a694f0e850d43fb8410eb3fa38a1f5103be5b5`
Quality Gate: GitHub Actions run #129 — SUCCESS

Verified:
- production dependency audit: PASS
- production build: PASS
- TypeScript: PASS
- regression tests: PASS
- ESLint/Prettier: PASS

## Live production baseline
Supabase project: `tevqysdswqkgqartpzdg` (Glam)
Read-only inspection only. No DDL/DML migration was applied.

Observed existing G3 infrastructure:
- `glam_memberships`
- `glam_service_specialists`
- `glam_schedule_windows`
- team invite/accept/revoke RPCs
- `glam_assign_service`
- `glam_set_schedule` / `glam_remove_schedule`
- `glam_team_directory`

Observed counts during review:
- organizations: 4
- services: 5
- appointments: 37
- reservations: 6
- service-specialist links: 3
- schedule windows: 6
- memberships: 2 owner memberships
- team_members rows: 0

## G3 decision
Do not create a parallel staff model.

The candidate now uses the existing invite/membership architecture.
Only one compatibility RPC is prepared:
- `glam_business_team_directory(p_org)` returns role-aware team rows for the business UI.

No new staff table, staff-service table, staff-availability table, or reservation staff column is proposed in this set.

Existing service assignment and schedule RPCs remain authoritative.

## G4 live gap
The following current candidate contracts are absent from production:
- Beauty Passport storage
- passport consent ledger / list / revoke RPCs
- Client 360 contacts
- Client 360 duplicate/create RPCs
- Client booking timeline RPC

## Minimal migration set prepared
1. `docs/sql/mvp/20261006_000_g3_team_directory_compat.sql`
2. `docs/sql/mvp/20261006_001_beauty_passport_minimal.sql`
3. `docs/sql/mvp/20261006_002_client_360_minimal.sql`

### Intentionally deferred
- salon-side Beauty Passport read
- automatic consent granting
- Client 360 notes
- tags
- follow-ups
- communications
- broad CRM automation
- new staff data model

## Security posture
- Beauty Passport raw rows remain customer-owned by RLS.
- No salon direct SELECT is granted on Beauty Passport.
- Consent list/revoke is via authenticated RPC.
- Client contacts are organization-scoped and readable only by owner/manager membership.
- Client mutation is RPC-only.
- New `glam_private` SECURITY DEFINER functions explicitly revoke PUBLIC/anon execution and grant authenticated execution only.
- Public wrappers also grant authenticated only.

## Important remaining G4 functional limitation
Client timeline can show booking history only for contacts whose `linked_customer_id` is already known.
The current candidate does not yet provide an automatic customer-linking mechanism.
Do not claim full Client 360 booking history until that linking path is designed and tested.

## Release status
NO DEPLOY / NO MAIN MERGE / NO PRODUCTION MIGRATIONS.

Next database gate:
1. isolated rehearsal of these three SQL files against a current schema copy;
2. negative tenant/RLS/RPC tests;
3. security advisor review on the rehearsal database;
4. current T0 recovery evidence;
5. human review;
6. explicit production migration approval.
