-- PROPOSAL ONLY. DO NOT place in supabase/migrations before MVP Gate.
-- Illustrative contract; live table/column names must be re-verified before conversion.

begin;

create table public.glam_import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.glam_organizations(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id),
  kind text not null check (kind in ('services','customers')),
  submitted_count integer not null check (submitted_count >= 0),
  accepted_count integer not null default 0 check (accepted_count >= 0),
  rejected_count integer not null default 0 check (rejected_count >= 0),
  status text not null check (status in ('processing','completed','failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- glam_commit_import_batch(p_org uuid,p_kind text,p_rows jsonb)
-- SECURITY DEFINER, search_path='', authenticated only.
-- MUST:
-- * verify auth.uid() owner/manager membership in p_org;
-- * ignore/reject organization identifiers inside p_rows;
-- * reject consent/passport fields;
-- * server-validate all rows;
-- * use reviewed service writer for services;
-- * write customers only to a tenant CRM-contact table, never auth.users;
-- * create/update the batch audit record atomically;
-- * return {batch_id,accepted,rejected,failures};
-- * never report success when zero rows were confirmed.

rollback;
