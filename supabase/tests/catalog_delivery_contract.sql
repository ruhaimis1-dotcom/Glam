-- Included in the rollback-only catalog fixture transaction.
create function pg_temp.save_delivery(mode text, target_org uuid default null) returns uuid
language sql security invoker as $$
 select public.glam_save_catalog_service_with_delivery(coalesce(target_org,f.org_a),s.id,s.name,s.minutes,s.price_sar,s.active,s.category_id,s.subcategory_id,s.pricing_mode,s.buffer_minutes,mode)
 from catalog_fixture f join public.glam_services s on s.id=f.created_service
$$;
grant execute on function pg_temp.save_delivery(text,uuid) to authenticated,anon;
select set_config('request.jwt.claim.sub',owner_a::text,true) from catalog_fixture;
set local role authenticated;
select pg_temp.save_delivery('both');
do $$ begin
 if (select count(*) from public.glam_service_delivery_options where service_id=(select created_service from catalog_fixture) and enabled)<>2 then raise exception 'owner channels missing'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',manager_a::text,true) from catalog_fixture;
set local role authenticated;
select pg_temp.save_delivery('home');
do $$ begin
 if (select count(*) from public.glam_service_delivery_options where service_id=(select created_service from catalog_fixture) and enabled)<>1 then raise exception 'manager update failed'; end if;
 begin
  perform pg_temp.save_delivery('invalid');
  raise exception 'invalid channel allowed' using errcode='ZX003';
 exception when invalid_parameter_value then null; end;
end $$;
reset role;
create function pg_temp.delivery_denied() returns void language plpgsql security invoker as $$
begin
 begin
  perform pg_temp.save_delivery('salon');
  raise exception 'unauthorized RPC allowed' using errcode='ZX004';
 exception when insufficient_privilege then null; end;
end $$;
grant execute on function pg_temp.delivery_denied() to authenticated,anon;
select set_config('request.jwt.claim.sub',customer::text,true) from catalog_fixture;
set local role authenticated;
select pg_temp.delivery_denied();
do $$ begin
 if exists(select 1 from public.glam_service_delivery_options where service_id=(select created_service from catalog_fixture) and channel='salon') then raise exception 'disabled channel exposed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',specialist::text,true) from catalog_fixture;
set local role authenticated;
select pg_temp.delivery_denied();
reset role;
select set_config('request.jwt.claim.sub',owner_b::text,true) from catalog_fixture;
set local role authenticated;
select pg_temp.delivery_denied();
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
select pg_temp.delivery_denied();
reset role;
do $$ begin
 if has_table_privilege('authenticated','public.glam_service_delivery_options','INSERT')
 or has_table_privilege('authenticated','public.glam_service_delivery_options','UPDATE')
 or has_table_privilege('authenticated','public.glam_service_delivery_options','DELETE') then raise exception 'direct mutation granted'; end if;
 if has_function_privilege('anon','public.glam_save_catalog_service_with_delivery(uuid,uuid,text,integer,numeric,boolean,uuid,uuid,text,integer,text)','EXECUTE') then raise exception 'anonymous RPC granted'; end if;
 begin
  update public.glam_service_delivery_options set organization_id=(select org_b from catalog_fixture) where service_id=(select created_service from catalog_fixture);
  raise exception 'cross tenant link accepted' using errcode='ZX004';
 exception when foreign_key_violation then null; end;
end $$;
