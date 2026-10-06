# P3 — Import Commit Layer (Proposal)

No runnable SQL and no production writes.

## Contract
The browser submits only normalized, user-confirmed rows. It never submits or controls organization_id.

Server/RPC must:
1. derive auth.uid();
2. verify owner/manager membership for p_org;
3. reject p_org not belonging to the caller;
4. validate the same row contract server-side;
5. check duplicates against existing organization data;
6. commit the batch transactionally or return per-row failures without pretending success;
7. write an import batch audit record with actor, organization, kind, counts and timestamp.

## Services
Use the existing reviewed catalog writer rather than direct table insert where possible. Categories must resolve inside the same organization.

## Customers
Imported rows are organization CRM contacts only. They are not auth.users and receive no Beauty Passport or consent. If a later invitation links a CRM contact to an authenticated customer, that is a separate explicit flow.

## Forbidden
- accepting organization_id from spreadsheet rows;
- importing Passport consent;
- creating auth users silently;
- service-role keys in browser;
- partial success without a result report;
- writing during Preview.
