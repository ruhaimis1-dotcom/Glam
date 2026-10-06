# GLAM MVP G3/G4 Minimal Migration Set — 2026-10-06

Status: **PREPARED ONLY — NOT APPLIED**

## Live production comparison
Project: `tevqysdswqkgqartpzdg`

### G3 — Staff operations
**Database migration required: NO**

The live database already provides the authoritative staff-assignment path:
- `glam_memberships(role='specialist')`
- `glam_service_specialists`
- `glam_schedule_windows`
- `glam_create_team_invite` / `glam_accept_team_invite`
- `glam_assign_service`
- `glam_set_schedule` / `glam_remove_schedule`
- `glam_team_directory`

Candidate code must consume this existing contract. Do not create `glam_staff`,
`glam_staff_services`, or `glam_staff_availability`.

### G4 — Beauty Passport
Required for current customer UI:
- customer-owned passport table;
- consent ledger;
- customer consent list/revoke RPCs.

Salon read access to passport data is intentionally **not** enabled in this MVP
migration. No booking automatically grants access.

### G4 — Client 360
Required for current UI:
- organization-scoped contact table;
- duplicate detection RPC;
- contact creation RPC;
- booking-only timeline RPC.

Deferred because current UI marks them as future/placeholder:
- client notes;
- tags;
- follow-ups;
- communications;
- salon-side passport read scopes.

## Candidate files
1. `docs/sql/mvp/20261006_001_beauty_passport_minimal.sql`
2. `docs/sql/mvp/20261006_002_client_360_minimal.sql`

## Release rule
These files are not production migrations yet. Before moving them into
`supabase/migrations`:
1. static/security review;
2. isolated rehearsal against a current schema copy;
3. negative tenant/RLS/RPC tests;
4. Supabase security advisors;
5. T0 recovery evidence;
6. explicit release approval.
