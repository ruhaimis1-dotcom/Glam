# P1.3 — Staff Assignment Contract (Proposal Only)

Status: design/architecture proposal. Not a runnable migration and not approved for production.

## Goal
Connect a salon staff member to the services she can perform, her working schedule, and an optional reservation assignment without rewriting historical reservations.

## Data contract
- `glam_staff_services(organization_id, staff_id, service_id, active)`
  - composite tenant-safe foreign keys; a staff member cannot be linked to another organization's service.
- `glam_staff_availability(organization_id, staff_id, weekday, start_time, end_time, active)`
  - Riyadh-local recurring working windows; overlapping windows for the same staff member are rejected.
- reservations gain nullable `staff_id` only at release migration time.
  - Existing reservations remain NULL.
  - New booking flow may offer “أي أخصائية” or an eligible active staff member.
  - Server assignment must validate organization, service eligibility, availability and collision at commit time.

## Business rules
1. Deactivated staff cannot receive new reservations; historical reservations remain readable.
2. A staff member is eligible only for explicitly linked active services.
3. UI availability is advisory; the database booking function is authoritative against race conditions.
4. No cross-organization staff/service/reservation relationship is permitted.
5. Customer-facing staff choice is optional for MVP; salon-side assignment is required before completion if the organization enables staff assignment.
6. Attendance, lateness, leave and bonuses are a later operations slice and must not be mixed into booking availability.

## Release gate
Before conversion to runnable SQL: verify the current live reservation/appointment keys, decide the authoritative time-slot source, add RLS/contract tests, rehearse on an isolated current copy, then include it in the consolidated MVP migration set.
