# PR #4 local database testing

Run from the repository root in PowerShell:

```powershell
./scripts/test-catalog-local.ps1
```

Prerequisites: Docker running Linux containers, the reviewed schema-only export
at `supabase/.temp/glam-schema-only.sql`, and the Supabase Postgres image
`public.ecr.aws/supabase/postgres:17.6.1.166`. The snapshot is deliberately excluded
from Git. The runner pins its SHA-256 and refuses an unreviewed replacement.
Obtain a separately authorized schema-only export when setting up another
machine; no production database credential is needed to run these tests.

The runner verifies the `glam-pr4-review` container has network `none`, no
published ports and the expected image. It creates a fresh database owned by
postgres from `template0`, restores public/glam_private/auth, applies both
migrations in order and runs `catalog_contract.sql`. That script includes
`catalog_booking_visibility.sql` and `catalog_delivery_contract.sql` using psql
`\ir`. It is a rollback assertion script, not pgTAP. The runner stops on failures
and verifies that users/services/reservations are empty after rollback.

Connections use `docker exec` and the container's Unix socket. The runner does
not use Supabase project links, remote URLs, production passwords or `db push`.
Its literal `local-pr4-fixture-only` password belongs only to the isolated test
container. The project-local CLI config and login helpers are not prerequisites
and are not included in this change.

The repository migrations are incremental changes, not a complete GLAM
bootstrap. The first migration needs `public.glam_services` and the rest of the
deployed baseline. A bare `supabase db start` fails with SQLSTATE 42P01. Never
replace the snapshot with the incompatible archived P1 proposal or repair the
production migration history to hide that mismatch.

See [executed results and remaining Auth/REST gates](../docs/architecture/PR4_LOCAL_TEST_RESULTS_2026_09_26_AR.md).
The local SQL suite uses test rows in auth.users and role/JWT-claim switching;
it does not start Auth or PostgREST, issue real access tokens, or exercise HTTP.
New databases are retained for inspection; the runner never deletes an existing
database or Docker volume.

## Auth / REST integration gate

```powershell
npm run test:catalog:http
```

Requires Node 22.18+ and the same reviewed snapshot. The standalone runner uses
Docker directly, without linking a Supabase project or reading application env
files. It refuses a remote Docker daemon or Docker endpoint overrides. It leaves
other projects and the SQL-only review container untouched.

Each run creates uniquely named containers: Supabase Postgres 17.6.1.166,
GoTrue v2.197.0, PostgREST v16.3, and Kong 2.8.1 (public.ecr.aws/supabase images).
Database, Auth and REST share an internal network without published ports.
Only Kong has a separate ingress network and a random loopback-only host port;
its routes expose `/auth/v1` and `/rest/v1`, with API-key validation.

The full snapshot is restored into a reference database. Its public/glam_private
schema is restored into the runtime database and compared before migrations:
normalized schema-only DDL, schema ACL/owners, Auth JWT helper definitions and
all 21 public foreign keys to auth.users. Recreating public requires reproducing
the baseline PUBLIC USAGE grant, which pg_dump assumes already exists.
The runner refuses a mismatch. Both PR migrations are then applied locally.

Auth initializes its own runtime schema using its official migrations. A
schema-only export contains no auth.schema_migrations ledger rows; copying a
made-up migration ledger would conceal compatibility errors. The runtime Auth
schema/settings are **not claimed to reproduce hosted Auth configuration**.
The GLAM application definitions, JWT helpers and Auth foreign keys are checked
against the snapshot. No production users or Auth credentials are copied.

Five separate users are created via the local Auth admin API and log in with
passwords. All authorization assertions use those users' JWTs or the anon role;
the locally generated service token only provisions test accounts. The suite
exercises real HTTP and the application's Supabase SDK repositories. Privileged
SQL only sets up fixtures and changes classifications/membership for test cases.

Fresh passwords and signing keys exist only in the ignored run directory under
supabase/.temp and local containers. Do not upload that directory. Results there
contain assertion labels and counts, not tokens. Containers stop in finally;
test data and stopped containers/volumes are retained for inspection, not reused.
The runner disconnects only its stopped containers from its own temporary networks
and removes those networks to avoid exhausting Docker address pools. Other projects'
networks are untouched. Recreate networking before restarting archived containers.

This is an opt-in integration gate, separate from the snapshot-free CI Node
tests. It does not render a browser UI or exercise external email/OAuth providers.

## Rendered browser gate

```powershell
npm run test:catalog:browser
```

Uses the same schema-verified Docker setup and a Vite server bound to
127.0.0.1:4175. Install dependencies with npm ci; Playwright is pinned in the
lockfile. On Windows, the runner uses installed Microsoft Edge in headless mode
with a fresh profile. Set GLAM_TEST_BROWSER=chrome to use installed Chrome.
No separate browser download or personal browser profile is needed.

The page is restricted to local requests; production Supabase requests would be
blocked and fail the suite. Local Kong enables CORS only for the test Vite origin.
Separate test users log in through the actual login form. Desktop 1440x1000 and
Pixel 7 emulation cover create/edit, account switching, customer booking, failed
reads and retry. Screenshots and result.json remain in the ignored run directory.
The browser and Vite server close at the end, as do this run's Docker containers.

Exit 0 means all requested checks completed, exit 1 indicates a failed assertion
or setup failure, and exit 2 means core checks passed but requested UI features
remain missing. The gate now checks 18 core checkpoints plus four delivery
checks: owner/manager create/edit/reload salon/home/both on each viewport, and
customer channel availability, stale-channel rejection/retry and persisted home
booking on each viewport. Assertions wait up to 15 seconds, including 503 retries.
It emulates a mobile viewport, not physical
Android/iOS hardware. Salon identity/display metadata still uses the existing
static salon directory; the local fixture matches that name, while services,
prices, appointments and reservations come from the local GLAM database.

## Delivery contract (additive migration 20260927141701)

The new checked RPC saves the service and enabled channels in one transaction.
Direct channel writes remain denied; SELECT follows tenant, publication and
active-service/category ceilings. New options inherit price/duration (NULL
overrides) and use zero travel fee. Existing overrides are preserved, not reset.
The booking UI and trigger refuse a channel needing a different price, duration
or travel fee until an explicit quotation flow exists. No implicit price change.

New reservations must send delivery_channel (salon/home); the database checks
the enabled channel again and retains it on the reservation. Existing history
is not backfilled. Services without configured channels cannot be booked; an
owner/manager must choose their channels.

## Reservation compatibility (additive migration 20260927155514)

All original reserve/reserve_direct/reschedule signatures and grants remain.
Additional overloads accept a required p_channel argument (no overload defaults).
Old callers omitting it resolve exactly one enabled channel; multiple channels
return DELIVERY_REQUIRED and zero return DELIVERY_UNAVAILABLE. No default salon
or home is invented. Rescheduling without a new choice preserves the original
channel; a historical NULL requires an explicit choice when ambiguous. The
replacement records channel/source/lineage without modifying the old channel.
Failed replacements roll back cancellation. Replays return the original result;
conflicting request identities/channels fail.

Both direct REST inserts and RPC bookings serialize by request identity and
specialist before eligibility/overlap reads. Service, category and channel locks
coordinate with catalog saves. Mutations require READ COMMITTED (PostgREST's
tested configuration); snapshot-isolated writers fail closed. A status-only
reactivation cannot fill an unknown historical channel.

The HTTP gate includes real concurrent requests, mixed REST/RPC overlapping
slots, concurrent replacements, settings/price changes held by separate database
sessions, and historical NULL fixtures. Privileged SQL only orchestrates local
fixtures/locks. SQL tests also exercise old/new wrappers, ACLs, atomic rollback
and preserved history. The browser gate continues to use the existing customer's
direct REST path, proving its compatibility with the new database guards.
