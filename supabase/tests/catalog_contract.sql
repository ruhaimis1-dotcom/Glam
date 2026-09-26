-- MANUAL INTEGRATION TEST, NOT EXECUTED. Run only after explicit approval on an
-- isolated clone of the actual GLAM baseline with the new migration applied.
-- psql --set ON_ERROR_STOP=1 --file supabase/tests/catalog_contract.sql
-- No pgTAP dependency. Every assertion raises on failure; all fixtures roll back.
begin;
set local statement_timeout='30s';

create temp table catalog_fixture as select
  gen_random_uuid() owner_a, gen_random_uuid() manager_a,
  gen_random_uuid() owner_b, gen_random_uuid() customer,
  gen_random_uuid() specialist, gen_random_uuid() org_a,
  gen_random_uuid() org_b, gen_random_uuid() org_hidden,
  gen_random_uuid() active_service, gen_random_uuid() inactive_service,
  gen_random_uuid() hidden_service, gen_random_uuid() inactive_variant,
  null::uuid category_a, null::uuid category_b, null::uuid subcategory_a,
  null::uuid created_service;
grant select,update on catalog_fixture to authenticated;
grant select on catalog_fixture to anon;

insert into auth.users(id) select owner_a from catalog_fixture
union all select manager_a from catalog_fixture
union all select owner_b from catalog_fixture
union all select customer from catalog_fixture
union all select specialist from catalog_fixture;
insert into public.glam_organizations(id,name,status)
select org_a,'Catalog test A','active' from catalog_fixture
union all select org_b,'Catalog test B','active' from catalog_fixture
union all select org_hidden,'Catalog test unpublished','active' from catalog_fixture;
insert into public.glam_memberships(organization_id,user_id,role)
select org_a,owner_a,'owner' from catalog_fixture
union all select org_a,manager_a,'manager' from catalog_fixture
union all select org_a,specialist,'specialist' from catalog_fixture
union all select org_b,owner_b,'owner' from catalog_fixture;
insert into public.glam_salon_pages(organization_id,slug,title,published)
select org_a,'test-'||org_a::text,'Test A',true from catalog_fixture
union all select org_b,'test-'||org_b::text,'Test B',true from catalog_fixture
union all select org_hidden,'test-'||org_hidden::text,'Unpublished',false from catalog_fixture;
insert into public.glam_services(id,organization_id,name,minutes,price_sar,active)
select active_service,org_a,'Visible',45,10,true from catalog_fixture
union all select inactive_service,org_a,'Inactive',45,20,false from catalog_fixture
union all select hidden_service,org_hidden,'Unpublished',45,30,true from catalog_fixture;
insert into public.glam_service_variants(id,service_id,name,minutes,price_sar,active)
select inactive_variant,active_service,'Inactive variant',60,30,false from catalog_fixture;

-- Exercise table-level policies through roles that cannot bypass RLS.
select set_config('request.jwt.claim.sub',owner_a::text,true) from catalog_fixture;
set local role authenticated;
do $$
declare f record; v uuid; before_revision integer;
begin
  select * into f from catalog_fixture;
  if (select count(*) from public.glam_services where id in (f.active_service,f.inactive_service)) <> 2 then
    raise exception 'owner cannot inspect own inactive services';
  end if;
  f.category_a := public.glam_save_catalog_category(f.org_a,null,'Test category',null);
  f.subcategory_a := public.glam_save_catalog_category(f.org_a,null,'Test subcategory',f.category_a);
  v := public.glam_save_catalog_service(f.org_a,null,'Created',45,0,false,f.category_a,f.subcategory_a,'from',15);
  if not exists(select 1 from public.glam_services where id=v and price_sar=0 and not active and buffer_minutes=15 and subcategory_id=f.subcategory_a) then
    raise exception 'create/read did not persist requested values';
  end if;
  select revision into before_revision from public.glam_services where id=v;
  if public.glam_save_catalog_service(f.org_a,v,'Edited',60,100,true,f.category_a,f.subcategory_a,'fixed',30) <> v then
    raise exception 'edit changed service identity';
  end if;
  if not exists(select 1 from public.glam_services where id=v and name='Edited' and minutes=60 and price_sar=100 and active and buffer_minutes=30 and revision=before_revision+1) then
    raise exception 'edit/read/revision mismatch';
  end if;
  perform public.glam_save_catalog_service(f.org_a,v,'Edited',60,100,true,f.category_a,f.subcategory_a,'fixed',30);
  if (select revision from public.glam_services where id=v) <> before_revision+1 then
    raise exception 'no-op edit incremented revision';
  end if;
  perform public.glam_save_catalog_service(f.org_a,v,'Edited',60,100,false,f.category_a,f.subcategory_a,'fixed',30);
  if (select revision from public.glam_services where id=v) <> before_revision+2 then
    raise exception 'active change did not increment revision';
  end if;
  begin
    perform public.glam_delete_catalog_category(f.org_a,f.category_a,false);
    raise exception 'linked category deletion unexpectedly succeeded';
  exception when foreign_key_violation then null; end;
  begin
    update public.glam_services set price_sar=999 where id=v;
    raise exception 'direct table update unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  update catalog_fixture set category_a=f.category_a,subcategory_a=f.subcategory_a,created_service=v;
end $$;
reset role;

select set_config('request.jwt.claim.sub',owner_b::text,true) from catalog_fixture;
set local role authenticated;
do $$
declare f record;
begin
  select * into f from catalog_fixture;
  update catalog_fixture set category_b=public.glam_save_catalog_category(f.org_b,null,'B category',null);
  begin
    perform public.glam_save_catalog_service(f.org_a,f.created_service,'Forged org',45,1,true,null,null,'fixed',0);
    raise exception 'forged organization allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.glam_save_catalog_service(f.org_b,f.created_service,'Forged id',45,1,true,null,null,'fixed',0);
    raise exception 'cross-tenant target ID allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform glam_private.delete_catalog_service(f.org_a,f.created_service);
    raise exception 'direct private function bypassed authorization';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub',manager_a::text,true) from catalog_fixture;
set local role authenticated;
do $$
declare f record; v uuid;
begin
  select * into f from catalog_fixture;
  begin
    perform public.glam_save_catalog_service(f.org_a,f.created_service,'Wrong category',45,1,true,f.category_b,null,'fixed',0);
    raise exception 'cross-tenant category allowed';
  exception when foreign_key_violation then null; end;
  v := public.glam_save_catalog_category(f.org_a,null,'Other parent',null);
  begin
    perform public.glam_save_catalog_service(f.org_a,f.created_service,'Wrong parent',45,1,true,v,f.subcategory_a,'fixed',0);
    raise exception 'mismatched subcategory parent allowed';
  exception when foreign_key_violation then null; end;
  perform public.glam_delete_catalog_category(f.org_a,v,false);
  perform public.glam_save_catalog_category(f.org_a,f.category_a,'Renamed',null);
  perform public.glam_save_catalog_category(f.org_a,f.subcategory_a,'Renamed sub',f.category_a);
  perform public.glam_save_catalog_service(f.org_a,f.created_service,'Manager edit',45,5,true,f.category_a,f.subcategory_a,'fixed',0);
end $$;
reset role;

-- A customer is a real auth user with NO memberships, not a fabricated role.
select set_config('request.jwt.claim.sub',customer::text,true) from catalog_fixture;
set local role authenticated;
do $$
declare f record;
begin
  select * into f from catalog_fixture;
  if not exists(select 1 from public.glam_services where id=f.active_service) then
    raise exception 'customer cannot read published active service';
  end if;
  if exists(select 1 from public.glam_services where id in(f.inactive_service,f.hidden_service)) then
    raise exception 'customer can read inactive or unpublished service';
  end if;
  if exists(select 1 from public.glam_service_variants where id=f.inactive_variant) then
    raise exception 'customer can read inactive variant';
  end if;
  if not exists(select 1 from public.glam_service_categories where id=f.category_a) then
    raise exception 'customer category read grant/policy missing';
  end if;
  begin
    perform public.glam_save_catalog_service(f.org_a,null,'Denied',45,1,true,null,null,'fixed',0);
    raise exception 'customer service create allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.glam_save_catalog_service(f.org_a,f.active_service,'Denied',45,1,true,null,null,'fixed',0);
    raise exception 'customer service edit allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.glam_delete_catalog_service(f.org_a,f.active_service);
    raise exception 'customer delete allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.glam_save_catalog_category(f.org_a,null,'Denied',null);
    raise exception 'customer category create allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.glam_delete_catalog_category(f.org_a,f.category_a,false);
    raise exception 'customer category delete allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$
declare f record;
begin
  select * into f from catalog_fixture;
  if not exists(select 1 from public.glam_services where id=f.active_service) or
    not exists(select 1 from public.glam_service_categories where id=f.category_a) then
    raise exception 'anonymous published catalog read blocked';
  end if;
  if exists(select 1 from public.glam_services where id in(f.inactive_service,f.hidden_service)) then
    raise exception 'anonymous inactive/unpublished read allowed';
  end if;
  begin
    perform public.glam_save_catalog_service(f.org_a,null,'Denied',45,1,true,null,null,'fixed',0);
    raise exception 'anonymous RPC execution allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Constraints must protect old RPCs and privileged writers too, independently
-- of the new RPC validation. These deliberate invalid writes must roll back.
do $$
declare f record;
begin
  select * into f from catalog_fixture;
  begin
    update public.glam_services set category_id=f.category_b,subcategory_id=null where id=f.created_service;
    raise exception 'composite organization FK is ineffective';
  exception when foreign_key_violation then null; end;
  begin
    update public.glam_services set category_id=null where id=f.created_service;
    raise exception 'subcategory without parent allowed';
  exception when check_violation then null; end;
end $$;

update public.glam_service_categories set active=false where id=(select category_a from catalog_fixture);
select set_config('request.jwt.claim.sub',customer::text,true) from catalog_fixture;
set local role authenticated;
do $$
declare f record;
begin
  select * into f from catalog_fixture;
  if exists(select 1 from public.glam_service_categories where id=f.category_a)
    or exists(select 1 from public.glam_service_subcategories where id=f.subcategory_a)
    or exists(select 1 from public.glam_services where id=f.created_service) then
    raise exception 'inactive category leaked through older permissive policies';
  end if;
end $$;
reset role;
update public.glam_service_categories set active=true where id=(select category_a from catalog_fixture);

-- Revocation and specialist denial are checked after a successful manager edit.
delete from public.glam_memberships where user_id=(select manager_a from catalog_fixture);
select set_config('request.jwt.claim.sub',manager_a::text,true) from catalog_fixture;
set local role authenticated;
do $$
declare f record;
begin
  select * into f from catalog_fixture;
  begin
    perform public.glam_delete_catalog_service(f.org_a,f.created_service);
    raise exception 'revoked membership allowed';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',f.specialist::text,true);
  begin
    perform public.glam_save_catalog_service(f.org_a,f.created_service,'Denied',45,1,true,null,null,'fixed',0);
    raise exception 'specialist edit allowed';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',f.owner_a::text,true);
  perform public.glam_delete_catalog_service(f.org_a,f.created_service);
  perform public.glam_delete_catalog_category(f.org_a,f.subcategory_a,true);
  perform public.glam_delete_catalog_category(f.org_a,f.category_a,false);
  if exists(select 1 from public.glam_services where id=f.created_service) then
    raise exception 'service delete did not persist';
  end if;
end $$;
reset role;
rollback;
