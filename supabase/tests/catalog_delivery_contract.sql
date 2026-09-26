-- Existing delivery contract: schema supports salon/home, but API roles have
-- no SELECT/INSERT/UPDATE/DELETE grant. Do not silently broaden it in this PR.
insert into public.glam_service_delivery_options(organization_id,service_id,channel,price_sar,minutes)
select org_a,created_service,'salon',0,45 from catalog_fixture
union all select org_a,created_service,'home',25,60 from catalog_fixture;
do $$
declare f record;
begin
 select * into f from catalog_fixture;
 if (select count(*) from public.glam_service_delivery_options where service_id=f.created_service)<>2 then
   raise exception 'delivery channel fixtures missing';
 end if;
 begin
   insert into public.glam_service_delivery_options(organization_id,service_id,channel)
   values(f.org_a,f.created_service,'invalid-channel');
   raise exception 'invalid delivery channel accepted' using errcode='ZX003';
 exception when check_violation then null; end;
 if has_table_privilege('anon','public.glam_service_delivery_options','SELECT')
   or has_table_privilege('authenticated','public.glam_service_delivery_options','SELECT') then
   raise exception 'delivery read privileges unexpectedly changed';
 end if;
 if has_function_privilege('anon','glam_private.can_read_appointment(uuid)','EXECUTE') then
   raise exception 'anonymous private appointment function privilege broadened';
 end if;
 if exists(select 1 from pg_proc p,
   lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
   where p.oid='glam_private.catalog_service_bookable(uuid)'::regprocedure
   and a.grantee=0 and a.privilege_type='EXECUTE') then
   raise exception 'booking predicate unexpectedly executable by PUBLIC';
 end if;
end $$;

create function pg_temp.check_delivery_denied() returns void
language plpgsql security invoker as $$
declare f record;
begin
 select * into f from catalog_fixture;
 begin
   perform 1 from public.glam_service_delivery_options where service_id=f.created_service;
   raise exception 'delivery SELECT unexpectedly allowed' using errcode='ZX004';
 exception when insufficient_privilege then null; end;
 begin
   insert into public.glam_service_delivery_options(organization_id,service_id,channel)
   values(f.org_a,f.created_service,'salon');
   raise exception 'delivery INSERT unexpectedly allowed' using errcode='ZX004';
 exception when insufficient_privilege then null; end;
 begin
   update public.glam_service_delivery_options set enabled=false where service_id=f.created_service;
   raise exception 'delivery UPDATE unexpectedly allowed' using errcode='ZX004';
 exception when insufficient_privilege then null; end;
 begin
   delete from public.glam_service_delivery_options where service_id=f.created_service;
   raise exception 'delivery DELETE unexpectedly allowed' using errcode='ZX004';
 exception when insufficient_privilege then null; end;
end $$;
grant execute on function pg_temp.check_delivery_denied() to authenticated,anon;
select set_config('request.jwt.claim.sub',owner_a::text,true) from catalog_fixture;
set local role authenticated;
select pg_temp.check_delivery_denied();
reset role;
select set_config('request.jwt.claim.sub',manager_a::text,true) from catalog_fixture;
set local role authenticated;
select pg_temp.check_delivery_denied();
reset role;
select set_config('request.jwt.claim.sub',customer::text,true) from catalog_fixture;
set local role authenticated;
select pg_temp.check_delivery_denied();
reset role;
select set_config('request.jwt.claim.sub',specialist::text,true) from catalog_fixture;
set local role authenticated;
select pg_temp.check_delivery_denied();
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
select pg_temp.check_delivery_denied();
reset role;
