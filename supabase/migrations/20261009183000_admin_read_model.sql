-- GLAM Admin read model
-- PREPARED ONLY. DO NOT APPLY TO PRODUCTION WITHOUT EXPLICIT APPROVAL.
-- Purpose: give platform admins read-only operational views without widening table RLS.

begin;

create or replace function glam_private.require_platform_admin()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or not exists (
       select 1 from glam_private.platform_admins
       where user_id = auth.uid()
     )
  then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
end
$$;

revoke all on function glam_private.require_platform_admin() from public, anon, authenticated;

create or replace function glam_private.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform glam_private.require_platform_admin();
  return jsonb_build_object(
    'organizations', (select count(*) from public.glam_organizations),
    'bookings', (select count(*) from public.glam_reservations),
    'open_disputes', (select count(*) from public.glam_disputes where status='open'),
    'accounts', (select count(*) from public.glam_profiles)
  );
end
$$;

create or replace function glam_private.admin_salons()
returns table(
  id uuid,
  name text,
  status text,
  created_at timestamptz,
  page_title text,
  address text,
  slug text,
  published boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform glam_private.require_platform_admin();
  return query
  select
    o.id,
    o.name,
    o.status,
    o.created_at,
    p.title,
    p.address,
    p.slug,
    p.published
  from public.glam_organizations o
  left join public.glam_salon_pages p on p.organization_id=o.id
  order by o.created_at desc;
end
$$;

create or replace function glam_private.admin_bookings()
returns table(
  id uuid,
  status text,
  created_at timestamptz,
  appointment_id uuid,
  delivery_channel text,
  salon_name text,
  service_name text,
  starts_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform glam_private.require_platform_admin();
  return query
  select
    r.id,
    r.status,
    r.created_at,
    r.appointment_id,
    r.delivery_channel,
    a.salon_name,
    a.service_name,
    a.starts_at
  from public.glam_reservations r
  left join public.glam_appointments a on a.id=r.appointment_id
  order by r.created_at desc
  limit 100;
end
$$;

create or replace function glam_private.admin_disputes()
returns table(
  id uuid,
  organization_id uuid,
  summary text,
  status text,
  resolution_note text,
  created_at timestamptz,
  resolved_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform glam_private.require_platform_admin();
  return query
  select
    d.id,
    d.organization_id,
    d.summary,
    d.status,
    d.resolution_note,
    d.created_at,
    d.resolved_at
  from public.glam_disputes d
  order by d.created_at desc
  limit 100;
end
$$;

create or replace function public.glam_admin_overview()
returns jsonb
language sql
stable
set search_path=''
as $$ select glam_private.admin_overview() $$;

create or replace function public.glam_admin_salons()
returns table(
  id uuid,
  name text,
  status text,
  created_at timestamptz,
  page_title text,
  address text,
  slug text,
  published boolean
)
language sql
stable
set search_path=''
as $$ select * from glam_private.admin_salons() $$;

create or replace function public.glam_admin_bookings()
returns table(
  id uuid,
  status text,
  created_at timestamptz,
  appointment_id uuid,
  delivery_channel text,
  salon_name text,
  service_name text,
  starts_at timestamptz
)
language sql
stable
set search_path=''
as $$ select * from glam_private.admin_bookings() $$;

create or replace function public.glam_admin_disputes()
returns table(
  id uuid,
  organization_id uuid,
  summary text,
  status text,
  resolution_note text,
  created_at timestamptz,
  resolved_at timestamptz
)
language sql
stable
set search_path=''
as $$ select * from glam_private.admin_disputes() $$;

revoke all on function glam_private.admin_overview() from public, anon, authenticated;
revoke all on function glam_private.admin_salons() from public, anon, authenticated;
revoke all on function glam_private.admin_bookings() from public, anon, authenticated;
revoke all on function glam_private.admin_disputes() from public, anon, authenticated;

revoke all on function public.glam_admin_overview() from public, anon;
revoke all on function public.glam_admin_salons() from public, anon;
revoke all on function public.glam_admin_bookings() from public, anon;
revoke all on function public.glam_admin_disputes() from public, anon;

grant execute on function public.glam_admin_overview() to authenticated;
grant execute on function public.glam_admin_salons() to authenticated;
grant execute on function public.glam_admin_bookings() to authenticated;
grant execute on function public.glam_admin_disputes() to authenticated;

notify pgrst, 'reload schema';
commit;
