# GLAM P1 — Service Intelligence Spec

Status: Implementation-ready
Parent: docs/AGENT_OS_PROJECT_BRAIN.md

## Goal
Turn the legacy service catalog into the first operational layer of GLAM's Beauty Intelligence Network while preserving the approved visual direction and working booking baseline.

## Source hierarchy
1. Product North Star: Beauty Intelligence Network
2. Approved visual direction (2026-09-21)
3. Approved UAT package (2026-09-20) as functional/legacy capability source only

Legacy UI must not override the newer visual/product direction.

## P1 service model
A service is more than name + price. The domain model must support:

### Identity
- Arabic name
- English name
- Arabic/English description
- main category
- subcategory
- active/draft state

### Commercial configuration
- pricing mode: fixed / starts-from / variant-based
- base price
- service variants/options
- variant-specific price and duration

### Time intelligence
- service duration
- preparation buffer before
- cleanup/post-service buffer after

### Beauty intelligence
- applicable hair/skin/nail profiles
- contraindications / warnings
- ingredients or product sensitivities
- required/preferred products
- notes used by GLAM assistant
- structured tags for later matching with Beauty Passport

### Privacy / experience
- female professional requirement
- private room support/requirement
- photography policy flags where relevant

### Localization
Arabic-first authoring with English translation fields. AI-assisted translation/classification may be added behind explicit user review; no silent publishing.

## P1 UI
Business > Services becomes the canonical management surface:
- quiet-luxury GLAM Business visual language
- service list grouped/filterable by category
- Add service flow using progressive cards/sections rather than a dense form
- contextual GLAM assistant suggestions
- clear Draft / Active state
- mobile + RTL first

## Data principles
- extend the existing Supabase service catalog rather than duplicate it
- preserve existing IDs used by bookings
- migrations must be additive and backward compatible during P1
- no mock fallback data in release paths
- tenant/org ownership required on mutable business data

## Acceptance criteria
- existing services remain readable
- salon can create/edit a structured intelligent service
- variants, price and duration remain compatible with booking
- buffers are represented in the model
- intelligence fields are stored structurally, not only as free text
- AR/EN fields supported
- Typecheck + production build + booking regression gate green
- visual review against approved GLAM direction before merge

## Out of scope
Beauty Passport implementation, POS, inventory, accounting, autonomous AI publishing.
