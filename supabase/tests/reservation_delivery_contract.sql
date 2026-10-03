-- Included before booking_fixture cleanup, inside the enclosing rollback.
create temp table delivery_rpc_fixture as select gen_random_uuid() target,
 gen_random_uuid() request,gen_random_uuid() move_request,null::uuid original,null::uuid replacement;
grant select,update on delivery_rpc_fixture to authenticated;
insert into public.glam_appointments(id,organization_id,specialist_id,salon_name,specialist_name,service_name,starts_at,ends_at,price_sar,service_id,service_revision)
select d.target,a.organization_id,a.specialist_id,a.salon_name,a.specialist_name,a.service_name,a.starts_at+interval '2 hours',a.ends_at+interval '2 hours',a.price_sar,a.service_id,a.service_revision
from public.glam_appointments a,booking_fixture b,delivery_rpc_fixture d where a.id=b.appointment_id;
select set_config('request.jwt.claim.sub',customer::text,true) from catalog_fixture;
set local role authenticated;
update delivery_rpc_fixture set original=public.glam_reserve_direct('test-'||(select org_a::text from catalog_fixture),(select appointment_id from booking_fixture),request,'home');
do $$ declare f record; begin
 select * into f from delivery_rpc_fixture;
 if not exists(select 1 from public.glam_reservations where id=f.original and delivery_channel='home' and booking_source='salon_link') then raise exception 'RPC did not persist selected channel/source'; end if;
 if public.glam_reserve((select appointment_id from booking_fixture),f.request,'home')<>f.original then raise exception 'replay mismatch'; end if;
 begin
  perform public.glam_reserve((select appointment_id from booking_fixture),f.request,'salon');
  raise exception 'replay changed channel' using errcode='ZX006';
 exception when raise_exception then if sqlerrm<>'REQUEST_MISMATCH' then raise; end if; end;
end $$;
reset role;
update public.glam_service_delivery_options set enabled=false where service_id=(select created_service from catalog_fixture) and channel='home';
set local role authenticated;
do $$ declare f record; begin
 select * into f from delivery_rpc_fixture;
 begin
  perform public.glam_reschedule(f.original,f.target,f.move_request);
  raise exception 'reschedule switched channel silently' using errcode='ZX006';
 exception when invalid_parameter_value then if sqlerrm<>'DELIVERY_UNAVAILABLE' then raise; end if; end;
 if not exists(select 1 from public.glam_reservations where id=f.original and status='confirmed' and delivery_channel='home') then raise exception 'failed reschedule changed original'; end if;
end $$;
reset role;
update public.glam_service_delivery_options set enabled=true where service_id=(select created_service from catalog_fixture) and channel='home';
set local role authenticated;
update delivery_rpc_fixture set replacement=public.glam_reschedule(original,target,move_request);
do $$ declare f record; begin
 select * into f from delivery_rpc_fixture;
 if not exists(select 1 from public.glam_reservations where id=f.replacement and status='confirmed' and delivery_channel='home' and replaces_reservation_id=f.original and booking_source='salon_link') then raise exception 'reschedule did not preserve channel/lineage/source'; end if;
 if not exists(select 1 from public.glam_reservations where id=f.original and status='cancelled' and delivery_channel='home') then raise exception 'reschedule changed historical channel'; end if;
 if public.glam_reschedule(f.original,f.target,f.move_request)<>f.replacement then raise exception 'reschedule replay failed'; end if;
end $$;
reset role;
do $$ declare signature text; begin
 foreach signature in array array[
  'public.glam_reserve(uuid,uuid,text)','public.glam_reserve_direct(text,uuid,uuid,text)','public.glam_reschedule(uuid,uuid,uuid,text)',
  'glam_private.reserve(uuid,uuid,text)','glam_private.reserve_direct(text,uuid,uuid,text)','glam_private.reschedule(uuid,uuid,uuid,text)'
 ] loop
  if has_function_privilege('anon',signature,'EXECUTE') or not has_function_privilege('authenticated',signature,'EXECUTE') then raise exception 'RPC ACL mismatch: %',signature; end if;
 end loop;
 if has_function_privilege('authenticated','glam_private.lock_booking_context(uuid,uuid,uuid)','EXECUTE') or has_function_privilege('authenticated','glam_private.resolve_booking_delivery(uuid,text)','EXECUTE') then raise exception 'internal helpers exposed'; end if;
end $$;
delete from public.glam_reservations where id in (select replacement from delivery_rpc_fixture);
delete from public.glam_reservations where id in (select original from delivery_rpc_fixture);
delete from public.glam_appointments where id in (select target from delivery_rpc_fixture);
