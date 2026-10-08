# P4 — GLAM Client 360

## Product objective
Give salon owners/managers one operational customer view that improves retention and follow-up without turning GLAM into a generic CRM.

## MVP surface
1. Client identity inside the salon: display name, phone/email when lawfully held by the salon.
2. Booking/service history from existing reservation/appointment truth.
3. Salon-owned notes.
4. Tags/segments.
5. Follow-up: due date, owner, status and reason.
6. Communication log: channel, direction, outcome and timestamp (log only in MVP; no automated messaging requirement).
7. Beauty Passport: consent/access status only. Never copy Passport payload into CRM.

## Boundaries
- A CRM contact belongs to exactly one organization.
- Imported contacts remain CRM contacts; they do not become auth users.
- A linked authenticated customer is optional and explicit.
- Organization A can never read/write Organization B contacts, notes, tags or follow-ups.
- Salon notes are salon-owned; Beauty Passport remains customer-owned.
- No health diagnosis fields.
- No marketing consent inference from booking, import, phone or email possession.
- Follow-up is operational by default; marketing outreach requires the appropriate consent policy separately.

## Reuse
- Reservation/service timeline must derive from existing glam_reservations + glam_appointments rather than a duplicated service-history table.
- Existing business membership authorization remains the manager/owner gate.

## HEXA OS review
Strategy: prioritize retention/follow-up value over pipeline complexity.
Labs: test tenant isolation, duplicate contact matching, stale follow-ups, linked/unlinked customer cases.
Agent OS: Spec -> Architecture -> Implement -> QA/Security -> Human Gate.
