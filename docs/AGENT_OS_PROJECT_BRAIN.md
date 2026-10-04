# GLAM — Agent OS Project Brain

Status: Approved baseline — 2026-09-23

## Product North Star
GLAM is a Saudi-first Beauty Intelligence Network, not merely a booking marketplace or a smaller Fresha clone.

Core moat:
1. Glam Beauty Passport — a customer-owned beauty identity shared only with explicit consent.
2. Glam Service Intelligence — structured intelligence around services, duration, pricing, products, suitability and outcomes.
3. The learning loop between customer preferences, service configuration, professional, salon and outcome.

## Product surfaces
- Customer experience
- GLAM Business (salon/provider)
- GLAM central administration

## MVP execution order
1. Service Intelligence
2. Beauty Passport + privacy/consent
3. Excel/CSV import for services/customers
4. Booking integration using Passport + Service Intelligence
5. Full UAT and release candidate

Deferred until the core differentiator is validated:
- POS
- Inventory
- Accounting
- Broad back-office parity with mature competitors

## Beauty Passport
The Passport may include:
- hair, skin and nail attributes
- allergies and prohibited ingredients/products
- previous services and outcomes
- dye shades/formulas used
- privacy, photography, professional and private-room preferences
- before/after images with explicit consent
- budget and preferred duration
- suggested recurring appointments
- services that worked/did not work
- consent-controlled portability to another salon

## Service Intelligence
When creating/importing a service, GLAM should be able to assist with:
- Arabic/English naming and description
- main/subcategory
- pricing model and range
- realistic duration
- preparation and post-service buffer
- required products
- conflicts with other services or customer sensitivities
- learning from actual duration/outcomes
- structured Excel/CSV migration

## Visual Source of Truth
The approved 2026-09-21 visual direction is the source of truth:
- quiet luxury / warm beauty aesthetic
- Arabic-first RTL
- burgundy-led palette, warm blush/ivory surfaces
- restrained cards, generous whitespace, subtle borders/shadows
- GLAM customer brand and GLAM Business variant
- approved star mark/logo must not be reinterpreted
- Beauty Passport is a first-class visual/product element
- AI assistance is contextual and calm, not a generic chatbot

Implementation or legacy deployments must not redefine the visual system merely because they are newer code.

## Architecture principles
- Modular monolith
- PostgreSQL/Supabase multi-tenant data model
- clear domain boundaries
- privacy and consent by design
- Riyadh/Saudi timezone correctness
- no mock fallback data in release paths
- preserve working booking/auth fixes only after quality gates

## Agent OS gates
Discovery -> Spec -> Architecture -> Design -> Implementation -> Typecheck/Test/Build -> Security/Privacy -> Browser UAT -> Human Approval -> Release -> Monitoring.

No phase may silently override an approved upstream artifact.

## Known implementation baseline
Repository: ruhaimis1-dotcom/Glam
Default branch: main
Known Vercel baseline: https://glam-o9tqbtajo-zawed1.vercel.app
Open draft PR #1 contains focused booking/auth/timezone fixes and must be validated before merge.

## Continuity checkpoint — 2026-10-04

Latest user-approved visual/voice direction supersedes the earlier quiet-luxury wording for new work: expressive warm beauty, Arabic-first RTL, berry `#541B35`, ivory `#FAF7F3`, accent `#AD705B`, and «جمالك، على مزاجك». Preserve the approved logo; do not invent a replacement. The existing font/logo implementation still requires verification against original identity files.

Actual encrypted-archive restoration (71 tables) and all four PR4 migrations passed on an isolated Windows Docker copy on October 4. No production migration or deployment is implied. SQL transfer now uses stdin; the former container-file transfer failed despite a successful copy exit status.

See `docs/architecture/GLAM_MVP_READINESS_2026_10_04_AR.md` for current evidence, production preflight scope, working booking/profile fixes, and incomplete MVP capabilities. A basic account name form is not Beauty Passport. Do not call a catalog/booking slice the complete approved MVP, or silently omit consent and CSV/Excel import. New frontend changes require a new browser gate; unchanged SQL does not require repeating the old archive rehearsal by default.
