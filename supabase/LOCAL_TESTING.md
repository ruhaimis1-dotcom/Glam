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
