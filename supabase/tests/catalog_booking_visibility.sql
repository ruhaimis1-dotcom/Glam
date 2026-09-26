-- Included by catalog_contract.sql inside its rollback transaction/fixtures.
-- Real bookings exercise both catalog and schedule triggers under authenticated.
create temp table booking_fixture as select gen_random_uuid() appointment_id,
  date_trunc('day',now()) + interval '2 days 12 hours' starts_at;
grant select on booking_fixture to authenticated,anon;
create temp table booking_failures(message text);
grant insert on booking_failures to authenticated,anon;

insert into public.glam_service_specialists(service_id,specialist_id)
select created_service,specialist from catalog_fixture;
insert into public.glam_schedule_windows(organization_id,specialist_id,kind,starts_at,ends_at)
select org_a,specialist,'shift',b.starts_at,b.starts_at+interval '8 hours'
from catalog_fixture cross join booking_fixture b;
insert into public.glam_appointments(id,organization_id,specialist_id,salon_name,specialist_name,service_name,starts_at,ends_at,price_sar,service_id,service_revision)
select b.appointment_id,f.org_a,f.specialist,'Test A','Test specialist',s.name,
  b.starts_at,b.starts_at+interval '45 minutes',s.price_sar,s.id,s.revision
from catalog_fixture f cross join booking_fixture b
join public.glam_services s on s.id=f.created_service;

create function pg_temp.check_booking_visibility(expected boolean, label text)
returns void language plpgsql security invoker as $$
declare f record; a uuid; visible boolean; booking_allowed boolean := false;
begin
 select * into f from catalog_fixture;
 select appointment_id into a from booking_fixture;
 select exists(select 1 from jsonb_array_elements(public.glam_salon_page('test-'||f.org_a::text)->'services') s
   where s->>'id'=f.created_service::text) into visible;
 if visible is distinct from expected then insert into booking_failures values(label||': salon_page'); end if;
 select exists(select 1 from public.glam_salon_slots('test-'||f.org_a::text) s where s.id=a) into visible;
 if visible is distinct from expected then insert into booking_failures values(label||': salon_slots'); end if;
 select exists(select 1 from public.glam_appointments where id=a) into visible;
 if visible is distinct from expected then insert into booking_failures values(label||': appointment SELECT'); end if;
 if current_user='authenticated' then
   select exists(select 1 from public.glam_available_appointments() s where s.id=a) into visible;
   if visible is distinct from expected then insert into booking_failures values(label||': available_appointments'); end if;
   begin
     insert into public.glam_reservations(appointment_id,customer_id,request_id,booking_source)
     values(a,f.customer,gen_random_uuid(),'salon_link');
     -- Roll back the test booking even on success so later probes see a free slot.
     raise exception 'ROLLBACK_TEST_BOOKING' using errcode='ZX001';
   exception
     when sqlstate 'ZX001' then booking_allowed := true;
     when raise_exception then
       if sqlerrm <> 'SERVICE_UNAVAILABLE' then raise; end if;
   end;
   if booking_allowed is distinct from expected then insert into booking_failures values(label||': booking trigger'); end if;
 end if;
end $$;
grant execute on function pg_temp.check_booking_visibility(boolean,text) to authenticated,anon;

select set_config('request.jwt.claim.sub',customer::text,true) from catalog_fixture;
set local role authenticated;
select pg_temp.check_booking_visibility(true,'active customer');
reset role;

update public.glam_service_subcategories set active=false where id=(select subcategory_a from catalog_fixture);
set local role authenticated;
select pg_temp.check_booking_visibility(false,'disabled subcategory customer');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
select pg_temp.check_booking_visibility(false,'disabled subcategory anonymous');
reset role;
update public.glam_service_subcategories set active=true where id=(select subcategory_a from catalog_fixture);
select set_config('request.jwt.claim.sub',customer::text,true) from catalog_fixture;
set local role authenticated;
select pg_temp.check_booking_visibility(true,'reactivated subcategory');
reset role;

update public.glam_service_categories set active=false where id=(select category_a from catalog_fixture);
set local role authenticated;
select pg_temp.check_booking_visibility(false,'disabled category customer');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
select pg_temp.check_booking_visibility(false,'disabled category anonymous');
reset role;
update public.glam_service_categories set active=true where id=(select category_a from catalog_fixture);
select set_config('request.jwt.claim.sub',customer::text,true) from catalog_fixture;
set local role authenticated;
select pg_temp.check_booking_visibility(true,'reactivated category');
reset role;

do $$
declare failures text;
begin
 if not exists(select 1 from public.glam_services where id=(select created_service from catalog_fixture) and active) then
   raise exception 'booking visibility fixture changed service.active';
 end if;
 select string_agg(message,E'\n') into failures from booking_failures;
 if failures is not null then raise exception E'Booking visibility regressions:\n%',failures; end if;
end $$;
-- A pre-existing booking remains readable after deactivation, while its slot
-- is not offered for a new booking. Preserve staff access to their schedule.
select set_config('request.jwt.claim.sub',customer::text,true) from catalog_fixture;
set local role authenticated;
insert into public.glam_reservations(appointment_id,customer_id,request_id,booking_source)
select b.appointment_id,f.customer,gen_random_uuid(),'salon_link'
from catalog_fixture f cross join booking_fixture b;
reset role;
update public.glam_service_categories set active=false where id=(select category_a from catalog_fixture);
set local role authenticated;
do $$ begin
 if not exists(select 1 from public.glam_appointments where id=(select appointment_id from booking_fixture)) then
   raise exception 'deactivation hid booked customer history';
 end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',manager_a::text,true) from catalog_fixture;
set local role authenticated;
do $$ begin
 if not exists(select 1 from public.glam_appointments where id=(select appointment_id from booking_fixture)) then
   raise exception 'deactivation hid manager schedule';
 end if;
end $$;
reset role;
update public.glam_service_categories set active=true where id=(select category_a from catalog_fixture);
delete from public.glam_reservations where appointment_id=(select appointment_id from booking_fixture);

-- Classification reactivation does not make stale service revisions bookable.
update public.glam_appointments set service_revision=service_revision-1
where id=(select appointment_id from booking_fixture);
select set_config('request.jwt.claim.sub',customer::text,true) from catalog_fixture;
set local role authenticated;
do $$
declare f record; a uuid;
begin
 select * into f from catalog_fixture;
 select appointment_id into a from booking_fixture;
 if exists(select 1 from public.glam_available_appointments() where id=a)
   or exists(select 1 from public.glam_salon_slots('test-'||f.org_a::text) where id=a) then
   raise exception 'stale revision offered for booking';
 end if;
 begin
   insert into public.glam_reservations(appointment_id,customer_id,request_id,booking_source)
   values(a,f.customer,gen_random_uuid(),'salon_link');
   raise exception 'stale revision booking allowed' using errcode='ZX002';
 exception when raise_exception then
   if sqlerrm <> 'SERVICE_UNAVAILABLE' then raise; end if;
 end;
end $$;
reset role;
-- Remove local FK fixtures before the enclosing service-delete tests.
delete from public.glam_appointments where id=(select appointment_id from booking_fixture);
delete from public.glam_service_specialists where service_id=(select created_service from catalog_fixture);
