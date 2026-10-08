# GLAM Candidate Consolidation Audit — 2026-10-06

Candidate: `agent-os/mvp-gate-2026-10-06`
Base development chain: `agent-os/p4-client-360`
Draft PR: #8

## Branch ancestry result
The active Agent OS development chain is linear:
- P1.2 -> P1.3: +8 commits
- P1.3 -> P2: +14 commits
- P2 -> P3: +52 commits
- P3 -> P4: +14 commits

Therefore P4 is the correct consolidation source. Main is intentionally behind and is not used as the development baseline.

## Legacy UAT branch review
Reviewed:
- `fix/uat-booking-riyadh-20260921`
- `uat/functional-booking-verification`

### Booking time handling
Current P4 contains the Riyadh timezone helpers from the booking-fix line, including:
- `BOOKING_TIME_ZONE = "Asia/Riyadh"`
- Riyadh date key formatting
- Riyadh time/date formatting
- unique-conflict mapping to `APPOINTMENT_UNAVAILABLE`

Decision: **do not cherry-pick the legacy booking-time branch**.

### Booking flow
Current P4 is newer than the legacy UAT flow and adds:
- persisted catalog loading through repository layer;
- delivery-channel selection and validation;
- fail-closed catalog loading;
- persisted reservation verification;
- explicit unavailable/retry states;
- customer booking repository isolation.

Decision: **keep P4 implementation; do not restore legacy local-storage-first behavior**.

### Password recovery
Current P4 login linked to `/reset-password` but the route was absent.
The functional UAT branch contained the Supabase password reset/recovery route.

Action:
- restored `src/routes/reset-password.tsx` into the MVP candidate.
- commit: `68fa63381e14a9f56a8d4e40b92d0fc1463b033b`.

### Deployment safety
The candidate branch initially was not covered by the Vercel deployment deny-list.

Action:
- added `agent-os/mvp-gate-2026-10-06: false` to `vercel.json`.
- commit: `b2a6ad2a645579ce8a2a032408148f7c6afc07e5`.

## Candidate decision
No bulk cherry-pick from legacy UAT branches is justified.
The only confirmed missing functional fix found in this pass was password recovery.
The current P4 booking implementation supersedes the older booking code.

## Gate state
- Production deploy: NOT AUTHORIZED.
- Production migrations: NOT AUTHORIZED.
- Main merge: NOT AUTHORIZED.
- Draft PR #8 exists only to obtain candidate CI/review evidence.
- Quality Gate for candidate is pending and must not be claimed green until GitHub reports success.
