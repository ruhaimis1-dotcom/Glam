# P4 — Client 360 Timeline Contract

The timeline is a read model, not a new source-of-truth table.

Sources:
- bookings/services: existing glam_reservations + glam_appointments;
- salon notes: glam_client_notes;
- follow-ups: glam_client_followups;
- communication log: glam_client_communications;
- Beauty Passport: consent/access metadata only.

Ordering: newest event first, with stable event id + occurred_at.

Tenant rule:
Every source query must be constrained by the authorized organization and contact relationship. A linked_customer_id alone is never sufficient to authorize access.

Booking matching:
- linked authenticated contact: match reservations by linked_customer_id AND salon/organization ownership;
- unlinked imported contact: no historical booking inference by phone/email in MVP. Linking requires an explicit reviewed action to avoid accidental identity merges.

Privacy:
Timeline must never persist or cache a copy of Passport profile/sensitivity/photo payloads.
