-- PROPOSAL ONLY. Intentionally not in supabase/migrations.
-- Convert only after schema/RLS/security review and isolated rehearsal.
begin;

create table public.glam_beauty_passports (
  customer_id uuid primary key references auth.users(id) on delete cascade,
  hair jsonb not null default '{}'::jsonb,
  skin jsonb not null default '{}'::jsonb,
  nails jsonb not null default '{}'::jsonb,
  sensitivities jsonb not null default '[]'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  customer_notes text,
  updated_at timestamptz not null default now()
);

create table public.glam_passport_consents (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.glam_organizations(id) on delete cascade,
  scopes text[] not null check (cardinality(scopes) > 0),
  consent_version integer not null default 1 check (consent_version > 0),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  check (expires_at is null or expires_at > granted_at)
);

create unique index glam_passport_one_active_consent
  on public.glam_passport_consents(customer_id, organization_id)
  where revoked_at is null;

create table public.glam_passport_observations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.glam_organizations(id) on delete cascade,
  author_user_id uuid not null references auth.users(id),
  reservation_id uuid,
  outcome text not null,
  created_at timestamptz not null default now()
);

create table public.glam_passport_access_log (
  id bigint generated always as identity primary key,
  customer_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.glam_organizations(id) on delete set null,
  actor_user_id uuid not null references auth.users(id),
  action text not null,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Direct salon SELECT on the raw passport table should remain unavailable.
-- A reviewed security-definer RPC should return only consented scopes and append the access log atomically.
-- Customer RLS and consent mutation policies are intentionally deferred until verified against the live baseline.

rollback;
