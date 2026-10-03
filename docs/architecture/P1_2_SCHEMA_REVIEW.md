# P1.2 — verified GLAM schema and review boundary

Follow-up implementation: [PR4_IMPLEMENTATION_FOLLOWUP.md](PR4_IMPLEMENTATION_FOLLOWUP.md).
The historical P1 file is now archived at `docs/sql/archive/20260923_001_service_intelligence.sql`;
the references below describe the original inspection. No SQL has been applied.

Inspected 2026-09-25 on `tevqysdswqkgqartpzdg`, the project referenced by
`src/lib/supabase.ts`. Inspection used SELECT queries against information_schema,
pg_catalog and pg_policies only. No migration, DDL, DML, mutation RPC, seed,
transactional write test, merge or deployment was performed.

Local starting commit: `08dd217`; branch: `agent-os/p1.2-business-operations`.
Objects `980e7a1`, `7ec6bf2`, and `243ba09` are absent locally. Nothing was
cherry-picked or inferred from them.

## Comparison with the historical migration

`supabase/migrations/20260923_001_service_intelligence.sql` describes an older
proposal, not the live database. It is unchanged and **must not be applied as a
prerequisite for this work**. In particular, `CREATE TABLE IF NOT EXISTS` would
not adapt an existing table to the proposed columns.

| Area               | Verified database                                                                          | Historical local migration                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Services           | `name`, `minutes`, `price_sar`, `active`, `revision`, required `organization_id`           | Adds nullable `name_ar`, `base_price_sar`, `duration_minutes`, plus `status` and other intelligence fields |
| Pricing            | `fixed`, `from`, `range`, `variants`                                                       | `fixed`, `starts_from`, `variants`; incompatible CHECK if added to the current column                      |
| Buffers            | One `buffer_minutes` (0–120)                                                               | Separate preparation and cleanup fields                                                                    |
| Categories         | `name`, `organization_id`, `sort_order`, `active`                                          | `name_ar`, `name_en`, `parent_id`                                                                          |
| Subcategories      | Separate `glam_service_subcategories` table with `category_id`                             | Self-referencing category hierarchy                                                                        |
| Service extensions | `glam_service_variants`, `glam_service_delivery_options`, `glam_service_specialists` exist | Proposes profile rules, sensitivities and products, which are absent                                       |
| Auth               | `glam_memberships(organization_id,user_id,role)`; roles owner/manager/specialist           | Mutation policy intentionally postponed                                                                    |
| Service writes     | Private checked `add_service`/`edit_service`, exposed by invoker wrappers                  | Direct inserts expected by the old repository                                                              |

Live service constraints: trimmed name 1–120 characters, minutes 15–480 in
15-minute steps, price SAR 0–10,000, category name 1–80, subcategory name 1–120.
The UI uses the actual `active` flag, not a fabricated persisted draft status.
Advanced P1 fields unsupported by this schema are not shown as writable fields.
Existing range/variant modes are preserved when editing; creating/configuring
their detailed options remains outside this slice.

## RLS and privileges

- RLS is enabled on memberships, organizations, services, categories and
  subcategories.
- Membership SELECT is self-only. Organization SELECT requires membership.
- Service SELECT allows membership and published salon catalog reads. The two
  published-service policies are redundant and do not check `active`.
- Category/subcategory ALL policies require owner/manager membership for both
  USING and WITH CHECK. Their published catalog SELECT policies also exist.
- `has_table_privilege` confirms authenticated can SELECT services, memberships
  and organizations, but has **no SELECT or mutation grant** on categories or
  subcategories. Anonymous can SELECT services; it has no category grants.
- Authenticated and anonymous have no direct service INSERT/UPDATE/DELETE grants.
- Authenticated can execute `glam_add_service` and `glam_edit_service`; anonymous
  cannot. Their private SECURITY DEFINER implementations check `auth.uid()` and
  owner/manager membership. Edit locks the row and increments revision when name,
  duration or price changes. These functions cannot save classification/buffer.
- Existing category FKs reference only IDs, not composite organization keys.
  No category/service triggers were returned by the trigger inspection.
- Appointments and specialist assignments reference services without cascading
  deletion; variants/delivery options use cascading service deletion.

Public salon reads are intentionally distinct from tenant-private management.
This change does not claim that published catalog rows are private, or alter
public visibility rules. Review inactive published services separately before
release. UI filtering is not a substitute for database enforcement.

## Proposed database follow-up — not applied

The complete review-only SQL is [P1_2_catalog_proposal.sql](../sql/P1_2_catalog_proposal.sql).
It is outside the migration runner and has not been executed, even on a local
database. It follows the existing checked private RPC pattern and proposes:

- Authenticated SELECT grants on the two category tables, with existing RLS.
- Composite foreign keys preventing cross-organization and mismatched-parent
  classification. A preflight refuses existing inconsistent links; it does not
  repair them automatically.
- Four atomic public RPC contracts used by the repository, delegating to checked
  private functions. Every mutation derives authority from `auth.uid()` plus
  owner/manager membership, scopes target IDs to the supplied organization, and
  rejects missing targets. PUBLIC/anonymous execute is revoked.
- Service revision updates covering booking-relevant catalog changes. Historical
  service IDs and booking snapshots are preserved.
- Referenced service deletion fails through existing FKs. Category deletion
  refuses linked subcategories/services instead of silently clearing links.

Until reviewed and applied separately, category reads and new writes on the
actual database remain blocked. The app displays an actionable error, disables
editing when loading fails, and never substitutes previews or localStorage data.
This PR is therefore a **draft, not release-ready**.

Before adoption, re-inspect the schema and ACLs, run the preflight read checks,
generate a migration with the Supabase CLI, and test the SQL on an isolated copy
of the verified schema. Do not run the old migration to create that test baseline.
The attempted aggregate data-consistency inspection was cancelled and not retried;
existing link integrity has not been certified.

## Validation and remaining gates

Local contract tests use a fake Supabase client, with no database connection.
They test application membership decisions, tenant filters, RPC payloads,
create/read/update/delete round-trips, zero-result writes, revoked access,
validation and surfaced errors. They **do not prove PostgreSQL RLS or RPC safety**.

Completed locally:

- Production build and generated route tree (also restores the existing booking
  child route missing from the checked-in generated tree).
- TypeScript check.
- Full ESLint: zero errors; existing Fast Refresh warnings remain. Baseline had
  7,336 errors, primarily formatting/CRLF plus explicit `any` types. Formatting
  normalization and a typed admin booking row fix preserve the existing lint
  rules; `.gitattributes` keeps future checkouts consistent.
- Node regression suite: 20 passing tests, including the booking timezone suite
  with its 11 assertions and 19 new catalog/access tests.
- Local HTTP SSR check of `/business/services`: 200, authorization-loading guard
  present, service editor and preview data absent before authentication.

Still required, without implying approval to run them:

| Gate                          | Cases                                                                                                                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Isolated database integration | Apply reviewed proposal against a copy of the actual schema; verify grants, policies, private/public function execute permissions and composite FK behavior                                  |
| Real CRUD                     | Service/category/subcategory creation, reload persistence, edit, revision behavior, deletion and deletion with linked bookings                                                               |
| Database tenant isolation     | Owner A and manager A against A/B, specialist, customer, anonymous, revoked membership, forged organization and target IDs; call both public wrappers and private functions where accessible |
| Hierarchy/concurrency         | Cross-tenant categories, mismatched subcategory parents, simultaneous delete/save and existing-data preflight                                                                                |
| Browser UAT                   | Authenticated desktop/mobile RTL, multi-org selection, sign-out/account changes, validation and retry, no premature success after a failed refresh                                           |

No browser was exposed to the computer-use tool in this session. Full visual and
authenticated UAT remains untested. Staff and central-admin workflows are not
converted to real data in this slice; admin's separate email-based gate remains
outside this salon-catalog change.
