-- GLAM MVP G4 minimal migration candidate
-- PREPARED ONLY. DO NOT APPLY TO PRODUCTION UNTIL MVP DATABASE GATE IS APPROVED.
-- Live baseline verified 2026-10-06 against project tevqysdswqkgqartpzdg.

begin;

create table public.glam_beauty_passports (
  customer_id uuid primary key references auth.users(id) on delete cascade,
  hair jsonb not null default '{}'::jsonb check (jsonb_typeof(hair) = 'object'),
  skin jsonb not null default '{}'::jsonb check (jsonb_typeof(skin) = 'object'),
  nails jsonb not null default '{}'::jsonb check (jsonb_typeof(nails) = 'object'),
  sensitivities jsonb not null default '[]'::jsonb check (jsonb_typeof(sensitivities) = 'array'),
  preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences) = 'object'),
  customer_notes text,
  updated_at timestamptz not null default now()
);

alter table public.glam_beauty_passports enable row level security;

create policy beauty_passport_customer_read
on public.glam_beauty_passports for select
to authenticated
using (customer_id = (select auth.uid()));

create policy beauty_passport_customer_insert
on public.glam_beauty_passports for insert
to authenticated
with check (customer_id = (select auth.uid()));

create policy beauty_passport_customer_update
on public.glam_beauty_passports for update
to authenticated
using (customer_id = (select auth.uid()))
with check (customer_id = (select auth.uid()));

grant select, insert, update on public.glam_beauty_passports to authenticated;

create table public.glam_passport_consents (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.glam_organizations(id) on delete cascade,
  scopes text[] not null,
  consent_version integer not null default 1 check (consent_version > 0),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  check (
    cardinality(scopes) > 0
    and scopes <@ array['profile','sensitivities','service_history','preferences','photos']::text[]
  ),
  check (expires_at is null or expires_at > granted_at)
);

create unique index glam_passport_one_active_consent
  on public.glam_passport_consents(customer_id, organization_id)
  where revoked_at is null;

alter table public.glam_passport_consents enable row level security;

-- No direct salon access. Customer consent reads/revocations are exposed only through
-- reviewed RPCs below so organization names can be returned without widening
-- glam_organizations RLS.
revoke all on public.glam_passport_consents from anon, authenticated;

create or replace function glam_private.my_passport_consents()
returns table(
  id uuid,
  organization_id uuid,
  organization_name text,
  scopes text[],
  granted_at timestamptz,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.organization_id, o.name, c.scopes, c.granted_at, c.expires_at
  from public.glam_passport_consents c
  join public.glam_organizations o on o.id = c.organization_id
  where auth.uid() is not null
    and c.customer_id = auth.uid()
    and c.revoked_at is null
    and (c.expires_at is null or c.expires_at > now())
  order by c.granted_at desc
$$;

create or replace function glam_private.revoke_passport_consent(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare result uuid;
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  update public.glam_passport_consents
     set revoked_at = now()
   where id = p_id
     and customer_id = auth.uid()
     and revoked_at is null
  returning id into result;

  if result is null then
    raise exception 'NOT_FOUND';
  end if;
  return result;
end
$$;

create or replace function public.glam_my_passport_consents()
returns table(
  id uuid,
  organization_id uuid,
  organization_name text,
  scopes text[],
  granted_at timestamptz,
  expires_at timestamptz
)
language sql
stable
set search_path = ''
as $$ select * from glam_private.my_passport_consents() $$;

create or replace function public.glam_revoke_passport_consent(p_id uuid)
returns uuid
language sql
set search_path = ''
as $$ select glam_private.revoke_passport_consent(p_id) $$;

revoke all on function public.glam_my_passport_consents() from public, anon;
revoke all on function public.glam_revoke_passport_consent(uuid) from public, anon;
grant execute on function public.glam_my_passport_consents() to authenticated;
grant execute on function public.glam_revoke_passport_consent(uuid) to authenticated;

commit;
