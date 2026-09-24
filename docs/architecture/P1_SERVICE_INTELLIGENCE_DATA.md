# P1 Service Intelligence — Architecture & Data Model

## Current baseline finding
The current `business.services.tsx` is a legacy flat CRUD surface. It reads `glam_services` and falls back to localStorage on database failure. The repository contains no versioned Supabase migrations. P1 must remove release-path fallback behavior and introduce versioned additive migrations.

## Compatibility strategy
Do not replace `glam_services` IDs. Existing booking references remain valid. Add columns/tables around the existing catalog and migrate UI reads progressively.

## Proposed additive schema

### glam_service_categories
- id uuid PK
- organization_id uuid NOT NULL
- parent_id uuid NULL -> glam_service_categories.id
- name_ar text NOT NULL
- name_en text
- slug text
- active boolean default true
- sort_order integer default 0
- created_at / updated_at

### glam_services — additive fields
Keep existing id and legacy fields during transition.
- organization_id uuid
- category_id uuid
- name_ar text
- name_en text
- description_ar text
- description_en text
- status text: draft | active | archived
- pricing_mode text: fixed | starts_from | variants
- base_price_sar numeric
- duration_minutes integer
- prep_buffer_minutes integer default 0
- cleanup_buffer_minutes integer default 0
- intelligence_notes text
- female_professional_required boolean default false
- private_room_supported boolean default false
- private_room_required boolean default false
- photography_policy text: salon_policy | allowed_with_consent | prohibited
- created_at / updated_at

### glam_service_variants
- id uuid PK
- service_id uuid NOT NULL
- name_ar text NOT NULL
- name_en text
- price_sar numeric
- duration_minutes integer
- active boolean default true
- sort_order integer default 0

### glam_service_profile_rules
Structured matching layer for Beauty Passport.
- id uuid PK
- service_id uuid NOT NULL
- dimension text: hair | skin | nails
- attribute_key text
- operator text: supports | prefers | excludes | warns
- attribute_value text
- severity text: info | warning | block
- note_ar / note_en

### glam_service_sensitivities
- id uuid PK
- service_id uuid NOT NULL
- ingredient_or_product text NOT NULL
- rule text: contains | may_contain | avoid
- note_ar / note_en

### glam_service_products
- id uuid PK
- service_id uuid NOT NULL
- product_name text NOT NULL
- requirement text: required | preferred | optional
- usage_note text

## Tenant boundary
All business-owned service/category mutations must resolve organization from authenticated membership; never trust a salon name sent by the client. RLS must enforce organization membership.

## Transition rules
1. Backfill `name_ar` from legacy `name` where present.
2. Backfill `base_price_sar` from legacy `price` or `price_sar` only when available.
3. Existing booking reads continue to work during migration.
4. No destructive rename/drop in P1.
5. Remove localStorage fallback from the release path once database migration is deployed.

## UI architecture
`/business/services` becomes:
- catalog header + search/filter
- category navigation
- structured service cards
- Add/Edit service progressive flow
- contextual assistant panel that suggests classification/translation/duration but requires human confirmation
- Draft/Active state is explicit

## P1 implementation slices
A. Versioned migration + typed service domain
B. Catalog read/write repository
C. Services list UI
D. Add/Edit intelligent service flow
E. Booking compatibility adapter
F. Quality + visual gate
