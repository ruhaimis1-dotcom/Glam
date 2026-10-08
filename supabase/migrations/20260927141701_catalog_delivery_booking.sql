-- Additive contract, exercised only against the isolated GLAM schema snapshot.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

-- Refuse cross-tenant legacy links, never repair customer data implicitly.
alter table public.glam_services add constraint glam_services_org_id_unique unique(organization_id,id);
alter table public.glam_service_delivery_options add constraint glam_delivery_tenant_service_fk
  foreign key(organization_id,service_id) references public.glam_services(organization_id,id) on delete cascade;

alter policy service_delivery_managed_by_business_members on public.glam_service_delivery_options to authenticated;
revoke all on public.glam_service_delivery_options from public,anon,authenticated;
grant select on public.glam_service_delivery_options to anon,authenticated;
create policy catalog_delivery_read on public.glam_service_delivery_options for select to anon,authenticated
using (exists(select 1 from public.glam_services s where s.id=service_id and s.organization_id=glam_service_delivery_options.organization_id
  and glam_private.catalog_row_visible(s.organization_id,enabled and glam_private.catalog_service_bookable(s.id))));
create policy catalog_delivery_ceiling on public.glam_service_delivery_options as restrictive for select to anon,authenticated
using (exists(select 1 from public.glam_services s where s.id=service_id and s.organization_id=glam_service_delivery_options.organization_id
  and glam_private.catalog_row_visible(s.organization_id,enabled and glam_private.catalog_service_bookable(s.id))));

create function glam_private.save_catalog_service_with_delivery(p_org uuid,p_id uuid,p_name text,p_minutes integer,p_price numeric,p_active boolean,p_category uuid,p_subcategory uuid,p_pricing_mode text,p_buffer integer,p_delivery text)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  -- Existing implementation checks/locks membership and service ownership.
  if auth.uid() is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_delivery is null or p_delivery not in ('salon','home','both') then
    raise exception 'INVALID_DELIVERY' using errcode='22023';
  end if;
  result := glam_private.save_catalog_service(p_org,p_id,p_name,p_minutes,p_price,p_active,p_category,p_subcategory,p_pricing_mode,p_buffer);
  insert into public.glam_service_delivery_options(organization_id,service_id,channel,enabled)
    values(p_org,result,'salon',p_delivery in ('salon','both')),
          (p_org,result,'home',p_delivery in ('home','both'))
    on conflict(service_id,channel) do update set enabled=excluded.enabled;
  -- Preserve existing explicit price/duration/fee overrides; new rows inherit
  -- base price/duration via NULL and have no travel surcharge.
  return result;
end $$;
create function public.glam_save_catalog_service_with_delivery(p_org uuid,p_id uuid,p_name text,p_minutes integer,p_price numeric,p_active boolean,p_category uuid,p_subcategory uuid,p_pricing_mode text,p_buffer integer,p_delivery text)
returns uuid language sql security invoker set search_path='' as $$
 select glam_private.save_catalog_service_with_delivery(p_org,p_id,p_name,p_minutes,p_price,p_active,p_category,p_subcategory,p_pricing_mode,p_buffer,p_delivery)
$$;
revoke all on function glam_private.save_catalog_service_with_delivery(uuid,uuid,text,integer,numeric,boolean,uuid,uuid,text,integer,text),public.glam_save_catalog_service_with_delivery(uuid,uuid,text,integer,numeric,boolean,uuid,uuid,text,integer,text) from public,anon,authenticated;
grant execute on function glam_private.save_catalog_service_with_delivery(uuid,uuid,text,integer,numeric,boolean,uuid,uuid,text,integer,text),public.glam_save_catalog_service_with_delivery(uuid,uuid,text,integer,numeric,boolean,uuid,uuid,text,integer,text) to authenticated;

-- Historical reservations stay unchanged; new reservations require a channel.
alter table public.glam_reservations add column delivery_channel text
  check(delivery_channel in ('salon','home'));
create function glam_private.guard_delivery_channel() returns trigger
language plpgsql security definer set search_path='' as $$
declare a public.glam_appointments; s public.glam_services; d public.glam_service_delivery_options;
begin
  if tg_op='UPDATE' then
    if (new.delivery_channel,new.appointment_id) is distinct from (old.delivery_channel,old.appointment_id) then
      raise exception 'BOOKING_CHANNEL_IMMUTABLE' using errcode='22023';
    end if;
    if new.status<>'confirmed' or old.status='confirmed' then return new; end if;
  end if;
  select * into a from public.glam_appointments where id=new.appointment_id;
  select * into s from public.glam_services where id=a.service_id and organization_id=a.organization_id for share;
  if not found then raise exception 'DELIVERY_UNAVAILABLE' using errcode='22023'; end if;
  select * into d from public.glam_service_delivery_options where service_id=s.id and organization_id=s.organization_id
    and channel=new.delivery_channel and enabled for share;
  if not found then raise exception 'DELIVERY_UNAVAILABLE' using errcode='22023'; end if;
  -- Advanced channel price/duration/fees have no confirmed quote UI yet.
  -- Fail closed instead of silently charging a different price or duration.
  if d.travel_fee_sar<>0 or (d.price_sar is not null and d.price_sar<>s.price_sar)
    or (d.minutes is not null and d.minutes<>s.minutes) then
    raise exception 'DELIVERY_QUOTE_REQUIRED' using errcode='22023';
  end if;
  return new;
end $$;
revoke all on function glam_private.guard_delivery_channel() from public,anon,authenticated;
create trigger glam_delivery_booking before insert or update of delivery_channel,appointment_id,status
  on public.glam_reservations for each row execute function glam_private.guard_delivery_channel();
notify pgrst,'reload schema';
commit;
