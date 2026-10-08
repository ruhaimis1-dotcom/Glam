-- Additive follow-up; applied only to the isolated GLAM copy during review.
-- Preserve every deployed signature and historical reservation value.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

-- All reservation entry points (including direct REST INSERT) take the same
-- request -> specialist -> appointment -> organization -> service lock order.
-- This closes the overlapping-slot race outside the original reserve RPC.
create function glam_private.lock_booking_context(p_appointment uuid,p_request uuid,p_customer uuid)
returns public.glam_appointments language plpgsql security definer set search_path='' as $$
declare a public.glam_appointments; specialist uuid; s public.glam_services;
begin
 if auth.uid() is null or p_customer is distinct from auth.uid() then raise exception 'LOGIN_REQUIRED'; end if;
 if p_request is null then raise exception 'REQUEST_REQUIRED'; end if;
 -- Advisory locking relies on a fresh statement snapshot after waiting.
 -- Reject snapshot-isolated writers instead of allowing stale overlap reads.
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'BOOKING_ISOLATION_UNSUPPORTED'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('glam:request:'||p_customer::text||':'||p_request::text,0));
 select specialist_id into specialist from public.glam_appointments where id=p_appointment;
 if not found then raise exception 'UNAVAILABLE'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(specialist::text,0));
 select * into a from public.glam_appointments where id=p_appointment for share;
 if not found or a.specialist_id is distinct from specialist or a.starts_at<=now() then raise exception 'UNAVAILABLE'; end if;
 perform 1 from public.glam_organizations where id=a.organization_id and status='active' for share;
 if not found then raise exception 'UNAVAILABLE'; end if;
 select * into s from public.glam_services where id=a.service_id and organization_id=a.organization_id for share;
 if not found or not s.active or s.revision is distinct from a.service_revision
   or not exists(select 1 from public.glam_service_specialists where service_id=s.id and specialist_id=a.specialist_id) then raise exception 'SERVICE_UNAVAILABLE'; end if;
 if s.category_id is not null then
  perform 1 from public.glam_service_categories where id=s.category_id and organization_id=s.organization_id and active for share;
  if not found then raise exception 'SERVICE_UNAVAILABLE'; end if;
 end if;
 if s.subcategory_id is not null then
  perform 1 from public.glam_service_subcategories where id=s.subcategory_id and category_id=s.category_id and organization_id=s.organization_id and active for share;
  if not found then raise exception 'SERVICE_UNAVAILABLE'; end if;
 end if;
 if not glam_private.in_schedule(a.organization_id,a.specialist_id,a.starts_at,a.ends_at) then raise exception 'OUTSIDE_SCHEDULE'; end if;
 return a;
end $$;

create function glam_private.resolve_booking_delivery(p_service uuid,p_channel text)
returns text language plpgsql security definer set search_path='' as $$
declare s public.glam_services; d public.glam_service_delivery_options; selected text:=p_channel; choices integer;
begin
 select * into s from public.glam_services where id=p_service for share;
 if not found then raise exception 'SERVICE_UNAVAILABLE'; end if;
 if selected is null then
  -- Compatibility only when the database has exactly one enabled choice.
  -- Never guess salon vs home, nor create options for an unconfigured service.
  select count(*),min(channel) into choices,selected from public.glam_service_delivery_options
   where service_id=s.id and organization_id=s.organization_id and enabled;
  if choices>1 then raise exception 'DELIVERY_REQUIRED' using errcode='22023'; end if;
 end if;
 select * into d from public.glam_service_delivery_options where service_id=s.id and organization_id=s.organization_id and channel=selected and enabled for share;
 if not found then raise exception 'DELIVERY_UNAVAILABLE' using errcode='22023'; end if;
 if d.travel_fee_sar<>0 or (d.price_sar is not null and d.price_sar<>s.price_sar)
  or (d.minutes is not null and d.minutes<>s.minutes) then raise exception 'DELIVERY_QUOTE_REQUIRED' using errcode='22023'; end if;
 return selected;
end $$;

create function glam_private.guard_booking_concurrency() returns trigger
language plpgsql security definer set search_path='' as $$
declare a public.glam_appointments;
begin
 if tg_op='UPDATE' and (new.status<>'confirmed' or old.status='confirmed') then return new; end if;
 a:=glam_private.lock_booking_context(new.appointment_id,new.request_id,new.customer_id);
 if exists(select 1 from public.glam_reservations r join public.glam_appointments b on b.id=r.appointment_id
  where r.id<>new.id and r.status='confirmed' and b.specialist_id=a.specialist_id
    and b.starts_at<a.ends_at and b.ends_at>a.starts_at) then raise exception 'SLOT_TAKEN'; end if;
 return new;
end $$;
-- Alphabetically before catalog/delivery/schedule triggers: take locks before
-- any eligibility read, including on a cancelled reservation's reactivation.
create trigger glam_00_booking_concurrency before insert or update of status
 on public.glam_reservations for each row execute function glam_private.guard_booking_concurrency();

create or replace function glam_private.guard_delivery_channel() returns trigger
language plpgsql security definer set search_path='' as $$
declare service uuid;
begin
 if tg_op='UPDATE' then
  if (new.delivery_channel,new.appointment_id) is distinct from (old.delivery_channel,old.appointment_id) then
   raise exception 'BOOKING_CHANNEL_IMMUTABLE' using errcode='22023';
  end if;
  if new.status<>'confirmed' or old.status='confirmed' then return new; end if;
  -- A historical NULL must never be filled by a status-only update. Use a
  -- replacement reservation with an explicit choice instead.
  if new.delivery_channel is null then raise exception 'DELIVERY_REQUIRED' using errcode='22023'; end if;
 end if;
 select service_id into service from public.glam_appointments where id=new.appointment_id;
 new.delivery_channel:=glam_private.resolve_booking_delivery(service,new.delivery_channel);
 return new;
end $$;

create function glam_private.reserve(p_appointment uuid,p_request uuid,p_channel text)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.glam_appointments; r public.glam_reservations; result uuid;
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED'; end if;
 if p_request is null then raise exception 'REQUEST_REQUIRED'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('glam:request:'||auth.uid()::text||':'||p_request::text,0));
 select * into r from public.glam_reservations where customer_id=auth.uid() and request_id=p_request;
 if found then
  if r.appointment_id<>p_appointment or (p_channel is not null and r.delivery_channel is distinct from p_channel) then raise exception 'REQUEST_MISMATCH'; end if;
  return r.id;
 end if;
 a:=glam_private.lock_booking_context(p_appointment,p_request,auth.uid());
 insert into public.glam_reservations(appointment_id,customer_id,request_id,delivery_channel)
 values(a.id,auth.uid(),p_request,p_channel) returning id into result;
 return result;
end $$;
create or replace function glam_private.reserve(p_appointment uuid,p_request uuid)
returns uuid language sql security definer set search_path='' as $$select glam_private.reserve(p_appointment,p_request,null)$$;

create function glam_private.reserve_direct(p_slug text,p_appointment uuid,p_request uuid,p_channel text)
returns uuid language plpgsql security definer set search_path='' as $$
declare org uuid; result uuid; prior uuid;
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED'; end if;
 select p.organization_id into org from public.glam_salon_pages p join public.glam_organizations o on o.id=p.organization_id
  where p.slug=p_slug and p.published and o.status='active' for share of p,o;
 if org is null or not exists(select 1 from public.glam_appointments where id=p_appointment and organization_id=org) then raise exception 'WRONG_SALON'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('glam:request:'||auth.uid()::text||':'||p_request::text,0));
 select id into prior from public.glam_reservations where customer_id=auth.uid() and request_id=p_request;
 result:=glam_private.reserve(p_appointment,p_request,p_channel);
 -- Recheck after reserve acquires the appointment lock: a concurrent change
 -- must not move this booking outside the salon validated above.
 if not exists(select 1 from public.glam_appointments where id=p_appointment and organization_id=org) then raise exception 'WRONG_SALON'; end if;
 if prior is null then update public.glam_reservations set booking_source='salon_link' where id=result; end if;
 return result;
end $$;
create or replace function glam_private.reserve_direct(p_slug text,p_appointment uuid,p_request uuid)
returns uuid language sql security definer set search_path='' as $$select glam_private.reserve_direct(p_slug,p_appointment,p_request,null)$$;

create function glam_private.reschedule(p_id uuid,p_appointment uuid,p_request uuid,p_channel text)
returns uuid language plpgsql security definer set search_path='' as $$
declare old public.glam_reservations; replay public.glam_reservations; original public.glam_appointments; target public.glam_appointments; result uuid; selected text;
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED'; end if;
 if p_request is null then raise exception 'REQUEST_REQUIRED'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('glam:request:'||auth.uid()::text||':'||p_request::text,0));
 select * into old from public.glam_reservations where id=p_id and customer_id=auth.uid() for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 selected:=coalesce(p_channel,old.delivery_channel);
 select * into replay from public.glam_reservations where customer_id=auth.uid() and request_id=p_request;
 if found then
  if replay.replaces_reservation_id is distinct from p_id or replay.appointment_id<>p_appointment
   or (selected is not null and replay.delivery_channel is distinct from selected) then raise exception 'REQUEST_MISMATCH'; end if;
  return replay.id;
 end if;
 if old.status<>'confirmed' then raise exception 'NOT_CONFIRMED'; end if;
 target:=glam_private.lock_booking_context(p_appointment,p_request,auth.uid());
 select * into original from public.glam_appointments where id=old.appointment_id for share;
 if not found or original.starts_at<=now() or target.id=original.id then raise exception 'UNAVAILABLE'; end if;
 if target.organization_id<>original.organization_id or target.service_id is distinct from original.service_id then raise exception 'SERVICE_MISMATCH'; end if;
 -- No in-place mutation of the historical channel. Any failure rolls back the
 -- cancellation; omission preserves the original channel, never switches it.
 update public.glam_reservations set status='cancelled' where id=p_id;
 result:=glam_private.reserve(p_appointment,p_request,selected);
 update public.glam_reservations set replaces_reservation_id=p_id where id=result;
 return result;
end $$;
create or replace function glam_private.reschedule(p_id uuid,p_appointment uuid,p_request uuid)
returns uuid language sql security definer set search_path='' as $$select glam_private.reschedule(p_id,p_appointment,p_request,null)$$;

-- Required extra argument, no defaults: PostgREST selects the old signature
-- when old callers omit p_channel, and the new signature when it is present.
create function public.glam_reserve(p_appointment uuid,p_request uuid,p_channel text)
returns uuid language sql security invoker set search_path='' as $$select glam_private.reserve(p_appointment,p_request,p_channel)$$;
create function public.glam_reserve_direct(p_slug text,p_appointment uuid,p_request uuid,p_channel text)
returns uuid language sql security invoker set search_path='' as $$select glam_private.reserve_direct(p_slug,p_appointment,p_request,p_channel)$$;
create function public.glam_reschedule(p_id uuid,p_appointment uuid,p_request uuid,p_channel text)
returns uuid language sql security invoker set search_path='' as $$select glam_private.reschedule(p_id,p_appointment,p_request,p_channel)$$;

revoke all on function glam_private.lock_booking_context(uuid,uuid,uuid),glam_private.resolve_booking_delivery(uuid,text),glam_private.guard_booking_concurrency() from public,anon,authenticated;
revoke all on function glam_private.reserve(uuid,uuid,text),glam_private.reserve_direct(text,uuid,uuid,text),glam_private.reschedule(uuid,uuid,uuid,text),public.glam_reserve(uuid,uuid,text),public.glam_reserve_direct(text,uuid,uuid,text),public.glam_reschedule(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function glam_private.reserve(uuid,uuid,text),glam_private.reserve_direct(text,uuid,uuid,text),glam_private.reschedule(uuid,uuid,uuid,text),public.glam_reserve(uuid,uuid,text),public.glam_reserve_direct(text,uuid,uuid,text),public.glam_reschedule(uuid,uuid,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
