-- GLAM MVP G4 Client 360 minimal migration candidate
-- PREPARED ONLY. DO NOT APPLY TO PRODUCTION UNTIL MVP DATABASE GATE IS APPROVED.
-- Current UI needs contacts + duplicate/create RPC + booking timeline only.
-- Notes/tags/followups/communications remain deferred.

begin;

create table public.glam_client_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.glam_organizations(id) on delete cascade,
  linked_customer_id uuid references auth.users(id) on delete set null,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  phone text,
  email text,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (phone is not null or email is not null)
);

create index glam_client_contacts_org_name_idx
  on public.glam_client_contacts(organization_id, display_name);

create index glam_client_contacts_org_customer_idx
  on public.glam_client_contacts(organization_id, linked_customer_id)
  where linked_customer_id is not null;

alter table public.glam_client_contacts enable row level security;

create policy client_contacts_business_read
on public.glam_client_contacts for select
to authenticated
using (
  exists (
    select 1
    from public.glam_memberships m
    where m.organization_id = glam_client_contacts.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner','manager')
  )
);

grant select on public.glam_client_contacts to authenticated;
revoke insert, update, delete on public.glam_client_contacts from anon, authenticated;

create or replace function glam_private.find_client_contact_duplicates(
  p_org uuid,
  p_phone text,
  p_email text
)
returns setof public.glam_client_contacts
language sql
stable
security definer
set search_path = ''
as $$
  select c.*
  from public.glam_client_contacts c
  where auth.uid() is not null
    and c.organization_id = p_org
    and exists (
      select 1 from public.glam_memberships m
      where m.organization_id = p_org
        and m.user_id = auth.uid()
        and m.role in ('owner','manager')
    )
    and (
      (p_phone is not null and c.phone = btrim(p_phone))
      or
      (p_email is not null and lower(c.email) = lower(btrim(p_email)))
    )
  order by c.display_name
$$;

create or replace function glam_private.create_client_contact(
  p_org uuid,
  p_display_name text,
  p_phone text,
  p_email text
)
returns public.glam_client_contacts
language plpgsql
security definer
set search_path = ''
as $$
declare result public.glam_client_contacts;
begin
  if auth.uid() is null or not exists (
    select 1 from public.glam_memberships m
    where m.organization_id = p_org
      and m.user_id = auth.uid()
      and m.role in ('owner','manager')
  ) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  if p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 120 then
    raise exception 'INVALID';
  end if;

  if nullif(btrim(coalesce(p_phone,'')), '') is null
     and nullif(btrim(coalesce(p_email,'')), '') is null then
    raise exception 'CONTACT_CHANNEL_REQUIRED';
  end if;

  insert into public.glam_client_contacts(
    organization_id, display_name, phone, email
  ) values (
    p_org,
    btrim(p_display_name),
    nullif(btrim(coalesce(p_phone,'')), ''),
    nullif(lower(btrim(coalesce(p_email,''))), '')
  )
  returning * into result;

  return result;
end
$$;

create or replace function glam_private.client_timeline(p_org uuid, p_contact uuid)
returns table(
  id uuid,
  kind text,
  occurred_at timestamptz,
  title text,
  detail text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    'booking'::text,
    a.starts_at,
    a.service_name,
    case when r.status = 'confirmed' then 'مؤكد' else 'ملغي' end
  from public.glam_client_contacts c
  join public.glam_reservations r on r.customer_id = c.linked_customer_id
  join public.glam_appointments a on a.id = r.appointment_id
  where auth.uid() is not null
    and c.id = p_contact
    and c.organization_id = p_org
    and a.organization_id = p_org
    and exists (
      select 1 from public.glam_memberships m
      where m.organization_id = p_org
        and m.user_id = auth.uid()
        and m.role in ('owner','manager')
    )
  order by a.starts_at desc
$$;

revoke all on function glam_private.find_client_contact_duplicates(uuid,text,text) from public, anon;
revoke all on function glam_private.create_client_contact(uuid,text,text,text) from public, anon;
revoke all on function glam_private.client_timeline(uuid,uuid) from public, anon;
grant execute on function glam_private.find_client_contact_duplicates(uuid,text,text) to authenticated;
grant execute on function glam_private.create_client_contact(uuid,text,text,text) to authenticated;
grant execute on function glam_private.client_timeline(uuid,uuid) to authenticated;

create or replace function public.glam_find_client_contact_duplicates(
  p_org uuid, p_phone text, p_email text
)
returns setof public.glam_client_contacts
language sql
stable
set search_path = ''
as $$ select * from glam_private.find_client_contact_duplicates(p_org,p_phone,p_email) $$;

create or replace function public.glam_create_client_contact(
  p_org uuid, p_display_name text, p_phone text, p_email text
)
returns public.glam_client_contacts
language sql
set search_path = ''
as $$ select glam_private.create_client_contact(p_org,p_display_name,p_phone,p_email) $$;

create or replace function public.glam_client_timeline(p_org uuid, p_contact uuid)
returns table(id uuid, kind text, occurred_at timestamptz, title text, detail text)
language sql
stable
set search_path = ''
as $$ select * from glam_private.client_timeline(p_org,p_contact) $$;

revoke all on function public.glam_find_client_contact_duplicates(uuid,text,text) from public, anon;
revoke all on function public.glam_create_client_contact(uuid,text,text,text) from public, anon;
revoke all on function public.glam_client_timeline(uuid,uuid) from public, anon;

grant execute on function public.glam_find_client_contact_duplicates(uuid,text,text) to authenticated;
grant execute on function public.glam_create_client_contact(uuid,text,text,text) to authenticated;
grant execute on function public.glam_client_timeline(uuid,uuid) to authenticated;

commit;
