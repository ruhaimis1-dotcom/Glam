# P2 — Glam Beauty Passport + Consent

Status: MVP architecture/spec. No production migration or deployment.

## Ownership
The Beauty Passport belongs to the authenticated customer. A salon does not own or silently inherit it from a booking.

## MVP sections
- Hair: type/texture, concerns, color/formula notes.
- Skin: type, concerns and sensitivities.
- Nails: preferences/concerns.
- Allergies / prohibited ingredients or products.
- Service history notes and outcomes.
- Privacy preferences: private room, photography, professional preferences.
- Budget and preferred duration.
- Customer notes.

Medical diagnosis and inferred health conditions are out of scope. Free text must not be presented as medical advice.

## Consent model
A customer grants a specific organization access. Consent records:
- customer_id
- organization_id
- scopes: profile, sensitivities, service_history, preferences, photos
- granted_at
- expires_at nullable
- revoked_at nullable
- consent_version

Rules:
1. Default is no salon access.
2. Booking never implies Passport consent.
3. Photos require an explicit separate scope.
4. Customer can revoke access at any time.
5. Revocation blocks future reads; audit history is retained.
6. Organization staff can read only through active membership plus active customer consent.
7. No organization may write customer-owned core attributes. Salon observations/outcomes live separately and are customer-visible.
8. Consent is never imported from CSV/Excel or inferred from an existing customer record.

## Proposed entities
- glam_beauty_passports: one customer-owned row per auth user.
- glam_passport_consents: customer-to-organization scoped grants.
- glam_passport_observations: salon-authored outcome notes, tenant-bound and customer-visible.
- glam_passport_access_log: append-only audit events for organization reads/writes.
- private Storage bucket/path for Passport photos; metadata references only, no public URLs.

## RLS intent
Customer: CRUD own Passport; CRUD/revoke own consents; read observations and audit events about self.
Organization member: read only consented scopes for customers; create observations only for own organization and eligible customer relationship.
No anonymous Passport access. No service-role usage from the browser.

## Booking integration
At booking time, show a clear optional consent step. Booking can proceed without sharing Passport. If shared, the salon sees only granted scopes. The reservation stores a consent reference/version, not a copied Passport payload.

## MVP acceptance
- customer creates/edits Passport;
- another customer cannot read it;
- salon cannot read without consent;
- salon can read only granted scopes;
- photos stay hidden unless photo scope is granted;
- revoke takes effect on the next read;
- organization A cannot use organization B's consent;
- audit event is produced for salon access;
- booking works with zero Passport consent.
