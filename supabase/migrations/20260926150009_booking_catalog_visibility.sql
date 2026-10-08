-- Prepared and tested locally only. Preserve all deployed signatures and ACLs.
-- Requires the GLAM baseline and 20260925205817_catalog_contract_and_visibility.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- No management exemption: an inactive classification cannot be booked.
create function glam_private.catalog_service_bookable(p_service uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.glam_services s
    join public.glam_organizations o on o.id=s.organization_id and o.status='active'
    where s.id=p_service and s.active
      and (s.category_id is null or exists (
        select 1 from public.glam_service_categories c
        where c.id=s.category_id and c.organization_id=s.organization_id and c.active
      ))
      and (s.subcategory_id is null or exists (
        select 1 from public.glam_service_subcategories c
        where c.id=s.subcategory_id and c.organization_id=s.organization_id
          and c.category_id=s.category_id and c.active
      ))
  )
$$;
revoke all on function glam_private.catalog_service_bookable(uuid) from public,anon,authenticated;
grant execute on function glam_private.catalog_service_bookable(uuid) to anon,authenticated;

CREATE OR REPLACE FUNCTION "glam_private"."salon_page"("p_slug" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
 select jsonb_build_object('organization_id',p.organization_id,'slug',p.slug,'title',p.title,'description',p.description,'address',p.address,'logo_url',p.logo_url,'cover_url',p.cover_url,
 'services',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'minutes',s.minutes,'price_sar',s.price_sar) order by s.name) from public.glam_services s where s.organization_id=p.organization_id and s.active and glam_private.catalog_service_bookable(s.id)),'[]'::jsonb))
 from public.glam_salon_pages p join public.glam_organizations o on o.id=p.organization_id where p.slug=p_slug and p.published and o.status='active'
$$;

CREATE OR REPLACE FUNCTION "glam_private"."salon_slots"("p_slug" "text") RETURNS TABLE("id" "uuid", "organization_id" "uuid", "service_id" "uuid", "salon_name" "text", "specialist_name" "text", "service_name" "text", "starts_at" timestamp with time zone, "ends_at" timestamp with time zone, "price_sar" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
 select a.id,a.organization_id,a.service_id,a.salon_name,a.specialist_name,a.service_name,a.starts_at,a.ends_at,a.price_sar from public.glam_appointments a join public.glam_organizations o on o.id=a.organization_id and o.status='active'
 join public.glam_salon_pages p on p.organization_id=a.organization_id and p.slug=p_slug and p.published
 where a.starts_at>now()
 and exists(select 1 from public.glam_services s join public.glam_service_specialists x on x.service_id=s.id where s.id=a.service_id and s.active and glam_private.catalog_service_bookable(s.id) and s.revision=a.service_revision and x.specialist_id=a.specialist_id)
 and glam_private.in_schedule(a.organization_id,a.specialist_id,a.starts_at,a.ends_at)
 and not exists(select 1 from public.glam_reservations r join public.glam_appointments b on b.id=r.appointment_id where r.status='confirmed' and b.specialist_id=a.specialist_id and b.starts_at<a.ends_at and b.ends_at>a.starts_at)
 order by a.starts_at limit 100
$$;

CREATE OR REPLACE FUNCTION "glam_private"."available_appointments"() RETURNS SETOF "public"."glam_appointments"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
 select a.* from public.glam_appointments a join public.glam_organizations o on o.id=a.organization_id and o.status='active'
 where auth.uid() is not null and a.starts_at>now()
 and exists(select 1 from public.glam_services s join public.glam_service_specialists x on x.service_id=s.id where s.id=a.service_id and s.active and glam_private.catalog_service_bookable(s.id) and s.revision=a.service_revision and x.specialist_id=a.specialist_id)
 and glam_private.in_schedule(a.organization_id,a.specialist_id,a.starts_at,a.ends_at)
 and not exists(select 1 from public.glam_reservations r join public.glam_appointments b on b.id=r.appointment_id where r.status='confirmed' and b.specialist_id=a.specialist_id and b.starts_at<a.ends_at and b.ends_at>a.starts_at)
 order by a.starts_at limit 100
$$;

CREATE OR REPLACE FUNCTION "glam_private"."guard_catalog"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare a public.glam_appointments; s public.glam_services;
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED'; end if;
 select * into a from public.glam_appointments where id=new.appointment_id;
 if a.service_id is null then raise exception 'CATALOG_REQUIRED'; end if;
 select * into s from public.glam_services where id=a.service_id for share;
 if not found or not s.active or s.revision is distinct from a.service_revision or not exists(select 1 from public.glam_service_specialists where service_id=s.id and specialist_id=a.specialist_id) then raise exception 'SERVICE_UNAVAILABLE'; end if;
 -- Lock classification rows so concurrent deactivation waits for this booking.
 if s.category_id is not null then
   perform 1 from public.glam_service_categories c
   where c.id=s.category_id and c.organization_id=s.organization_id and c.active for share;
   if not found then raise exception 'SERVICE_UNAVAILABLE'; end if;
 end if;
 if s.subcategory_id is not null then
   perform 1 from public.glam_service_subcategories c
   where c.id=s.subcategory_id and c.organization_id=s.organization_id
     and c.category_id=s.category_id and c.active for share;
   if not found then raise exception 'SERVICE_UNAVAILABLE'; end if;
 end if;
 return new;
end $$;

-- Existing permissive published-appointment policies otherwise bypass the
-- catalog ceilings. Retain staff management and booked-customer history access.
create policy catalog_appointments_member_ceiling on public.glam_appointments
as restrictive for select to authenticated
using (glam_private.can_read_appointment(id)
  or glam_private.catalog_service_bookable(service_id));
-- anon cannot execute can_read_appointment; do not add that privilege just to
-- satisfy an OR expression's permission check.
create policy catalog_appointments_public_ceiling on public.glam_appointments
as restrictive for select to anon
using (glam_private.catalog_service_bookable(service_id));

notify pgrst, 'reload schema';
commit;
