# GLAM R01 isolated validation — NOT A RELEASE BRANCH

This disposable validation branch is based on the audited PR #10 source commit `7f170d211d7ef95556df343a4dd462b2b6e2b0db`. It does not update main, staging or the repair branch. Never merge this branch: its workflow and deployment settings are validation-only.

The three `repair.part*` files concatenate into one base64/gzip encoding of the exact locally prepared R01 patch. Decoded size: 50923 bytes. SHA-256: `45f12b58b990589bda5433bbbe8c06eef4884dfb4d49c299b46ef54cae0e1851`. The workflow validates this digest, confirms the underlying application files still match the audited source, and applies the patch only in its disposable workspace.

Scope: full build/typecheck/lint/regression plus a newly created loopback-only PostgreSQL cluster with synthetic roles/data. No hosted Supabase access, no application deploy, no secrets, no database migration on existing environments, no artifact uploads and no Actions cache. Node application traffic is restricted to loopback after dependency installation. The job uses only the standard public-repository ubuntu-24.04 runner and is skipped for private repositories.

Vercel automatic deployment is disabled in this branch before it is created. CI success does not certify hosted Auth/PostgREST, browser UAT, production readiness, or SCCC deployment. Those remain separate gates. Report every failed or unexecuted check; do not bypass them.

Policy evidence checked 2026-10-14: https://docs.github.com/en/billing/concepts/product-billing/github-actions and https://vercel.com/docs/project-configuration/git-configuration . Standard public runners are free; no larger runner, billable artifact/cache storage, AI service or paid API is used by this workflow.
