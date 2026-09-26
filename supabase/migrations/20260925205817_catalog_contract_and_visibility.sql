-- PREPARED ONLY; NOT APPLIED. Target: existing GLAM schema tevqysdswqkgqartpzdg.
-- Requires an isolated copy of the live baseline; this is NOT an empty-db bootstrap.
-- See docs/architecture/PR4_IMPLEMENTATION_FOLLOWUP.md before any execution.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Refuse pre-existing cross-tenant links rather than silently changing data.
do $$ begin
  if exists (select 1 from public.glam_services s join public.glam_service_categories c on c.id=s.category_id where c.organization_id<>s.organization_id)
    or exists (select 1 from public.glam_service_subcategories s join public.glam_service_categories c on c.id=s.category_id where c.organization_id<>s.organization_id)
    or exists (select 1 from public.glam_services s join public.glam_service_subcategories c on c.id=s.subcategory_id where c.organization_id<>s.organization_id or s.category_id is distinct from c.category_id)
  then raise exception 'EXISTING_CATEGORY_LINKS_REQUIRE_REVIEW'; end if;
end $$;

alter table public.glam_service_categories add constraint glam_categories_org_id_unique unique (organization_id,id);
alter table public.glam_service_subcategories add constraint glam_subcategories_org_parent_id_unique unique (organization_id,category_id,id);
alter table public.glam_service_subcategories add constraint glam_subcategories_tenant_parent_fk foreign key (organization_id,category_id) references public.glam_service_categories(organization_id,id);
alter table public.glam_services add constraint glam_services_tenant_category_fk foreign key (organization_id,category_id) references public.glam_service_categories(organization_id,id);
alter table public.glam_services add constraint glam_services_subcategory_requires_category check (subcategory_id is null or category_id is not null);
alter table public.glam_services add constraint glam_services_tenant_subcategory_fk foreign key (organization_id,category_id,subcategory_id) references public.glam_service_subcategories(organization_id,category_id,id);

-- Read grants and restrictive policies are installed below in this same transaction.

create function glam_private.save_catalog_service(p_org uuid,p_id uuid,p_name text,p_minutes integer,p_price numeric,p_active boolean,p_category uuid,p_subcategory uuid,p_pricing_mode text,p_buffer integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; existing public.glam_services;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  -- SHARE also conflicts with role UPDATE (KEY SHARE would not).
  perform 1 from public.glam_memberships where organization_id=p_org
    and user_id=auth.uid() and role in ('owner','manager') for share;
  if not found then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_active is null or p_name is null or p_minutes is null or p_price is null or p_pricing_mode is null or p_buffer is null then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  if p_category is not null then
    perform 1 from public.glam_service_categories where id=p_category and organization_id=p_org for key share;
    if not found then raise exception 'INVALID_CATEGORY' using errcode='23503'; end if;
  end if;
  if p_subcategory is not null then
    perform 1 from public.glam_service_subcategories where id=p_subcategory and organization_id=p_org and category_id=p_category for key share;
    if not found then raise exception 'INVALID_SUBCATEGORY' using errcode='23503'; end if;
  end if;
  if p_id is null then
    insert into public.glam_services(organization_id,name,minutes,price_sar,active,category_id,subcategory_id,pricing_mode,buffer_minutes)
    values(p_org,trim(p_name),p_minutes,p_price,p_active,p_category,p_subcategory,p_pricing_mode,p_buffer) returning id into result;
  else
    select * into existing from public.glam_services where id=p_id and organization_id=p_org for update;
    if not found then raise exception 'FORBIDDEN' using errcode='42501'; end if;
    update public.glam_services set name=trim(p_name),minutes=p_minutes,price_sar=p_price,active=p_active,
      category_id=p_category,subcategory_id=p_subcategory,pricing_mode=p_pricing_mode,buffer_minutes=p_buffer,
      revision=revision+case when (name,minutes,price_sar,active,category_id,subcategory_id,pricing_mode,buffer_minutes)
        is distinct from (trim(p_name),p_minutes,p_price,p_active,p_category,p_subcategory,p_pricing_mode,p_buffer) then 1 else 0 end
      where id=p_id and organization_id=p_org returning id into result;
  end if;
  return result;
end $$;

create function glam_private.delete_catalog_service(p_org uuid,p_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  -- SHARE also conflicts with role UPDATE (KEY SHARE would not).
  perform 1 from public.glam_memberships where organization_id=p_org
    and user_id=auth.uid() and role in ('owner','manager') for share;
  if not found then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  -- Existing appointment/specialist FKs prevent deleting referenced services.
  delete from public.glam_services where id=p_id and organization_id=p_org returning id into result;
  if result is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  return result;
end $$;

create function glam_private.save_catalog_category(p_org uuid,p_id uuid,p_name text,p_parent uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  -- SHARE also conflicts with role UPDATE (KEY SHARE would not).
  perform 1 from public.glam_memberships where organization_id=p_org
    and user_id=auth.uid() and role in ('owner','manager') for share;
  if not found then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and (case when p_parent is null then 80 else 120 end) then raise exception 'INVALID_NAME' using errcode='22023'; end if;
  if p_parent is null then
    if p_id is null then
      insert into public.glam_service_categories(organization_id,name) values(p_org,trim(p_name)) returning id into result;
    else
      update public.glam_service_categories set name=trim(p_name) where id=p_id and organization_id=p_org returning id into result;
    end if;
  else
    perform 1 from public.glam_service_categories where id=p_parent and organization_id=p_org for key share;
    if not found then raise exception 'INVALID_CATEGORY' using errcode='23503'; end if;
    if p_id is null then
      insert into public.glam_service_subcategories(organization_id,category_id,name) values(p_org,p_parent,trim(p_name)) returning id into result;
    else
      update public.glam_service_subcategories set name=trim(p_name) where id=p_id and organization_id=p_org and category_id=p_parent returning id into result;
    end if;
  end if;
  if result is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  return result;
end $$;

create function glam_private.delete_catalog_category(p_org uuid,p_id uuid,p_subcategory boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  -- SHARE also conflicts with role UPDATE (KEY SHARE would not).
  perform 1 from public.glam_memberships where organization_id=p_org
    and user_id=auth.uid() and role in ('owner','manager') for share;
  if not found then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_subcategory is null then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  if p_subcategory then
    perform 1 from public.glam_service_subcategories where id=p_id and organization_id=p_org for update;
    if not found then raise exception 'FORBIDDEN' using errcode='42501'; end if;
    if exists(select 1 from public.glam_services where subcategory_id=p_id) then raise exception 'CATEGORY_IN_USE' using errcode='23503'; end if;
    delete from public.glam_service_subcategories where id=p_id and organization_id=p_org returning id into result;
  else
    perform 1 from public.glam_service_categories where id=p_id and organization_id=p_org for update;
    if not found then raise exception 'FORBIDDEN' using errcode='42501'; end if;
    if exists(select 1 from public.glam_services where category_id=p_id) or exists(select 1 from public.glam_service_subcategories where category_id=p_id) then raise exception 'CATEGORY_IN_USE' using errcode='23503'; end if;
    delete from public.glam_service_categories where id=p_id and organization_id=p_org returning id into result;
  end if;
  return result;
end $$;

-- Follow the project's existing public invoker / private definer convention.
create function public.glam_save_catalog_service(p_org uuid,p_id uuid,p_name text,p_minutes integer,p_price numeric,p_active boolean,p_category uuid,p_subcategory uuid,p_pricing_mode text,p_buffer integer)
returns uuid language sql security invoker set search_path='' as $$ select glam_private.save_catalog_service(p_org,p_id,p_name,p_minutes,p_price,p_active,p_category,p_subcategory,p_pricing_mode,p_buffer) $$;
create function public.glam_delete_catalog_service(p_org uuid,p_id uuid)
returns uuid language sql security invoker set search_path='' as $$ select glam_private.delete_catalog_service(p_org,p_id) $$;
create function public.glam_save_catalog_category(p_org uuid,p_id uuid,p_name text,p_parent uuid)
returns uuid language sql security invoker set search_path='' as $$ select glam_private.save_catalog_category(p_org,p_id,p_name,p_parent) $$;
create function public.glam_delete_catalog_category(p_org uuid,p_id uuid,p_subcategory boolean)
returns uuid language sql security invoker set search_path='' as $$ select glam_private.delete_catalog_category(p_org,p_id,p_subcategory) $$;

revoke all on function glam_private.save_catalog_service(uuid,uuid,text,integer,numeric,boolean,uuid,uuid,text,integer), glam_private.delete_catalog_service(uuid,uuid), glam_private.save_catalog_category(uuid,uuid,text,uuid), glam_private.delete_catalog_category(uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.glam_save_catalog_service(uuid,uuid,text,integer,numeric,boolean,uuid,uuid,text,integer), public.glam_delete_catalog_service(uuid,uuid), public.glam_save_catalog_category(uuid,uuid,text,uuid), public.glam_delete_catalog_category(uuid,uuid,boolean) from public,anon,authenticated;
grant usage on schema glam_private to authenticated;
grant execute on function glam_private.save_catalog_service(uuid,uuid,text,integer,numeric,boolean,uuid,uuid,text,integer), glam_private.delete_catalog_service(uuid,uuid), glam_private.save_catalog_category(uuid,uuid,text,uuid), glam_private.delete_catalog_category(uuid,uuid,boolean) to authenticated;
grant execute on function public.glam_save_catalog_service(uuid,uuid,text,integer,numeric,boolean,uuid,uuid,text,integer), public.glam_delete_catalog_service(uuid,uuid), public.glam_save_catalog_category(uuid,uuid,text,uuid), public.glam_delete_catalog_category(uuid,uuid,boolean) to authenticated;

-- This private predicate avoids granting anonymous callers access to memberships
-- or organizations, and avoids recursive RLS on the catalog tables. It exposes
-- only a boolean; the caller identity is always derived from auth.uid().
create function glam_private.catalog_row_visible(p_org uuid, p_active boolean)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.glam_memberships m
    where m.organization_id=p_org and m.user_id=auth.uid()
      and m.role in ('owner','manager')
  ) or (
    coalesce(p_active,false) and exists (
      select 1 from public.glam_salon_pages p
      join public.glam_organizations o on o.id=p.organization_id
      where p.organization_id=p_org and p.published and o.status='active'
    )
  )
$$;
revoke all on function glam_private.catalog_row_visible(uuid,boolean) from public,anon,authenticated;
grant execute on function glam_private.catalog_row_visible(uuid,boolean) to anon,authenticated;
-- No new anon USAGE on glam_private: policies resolve the function at creation.

alter table public.glam_services enable row level security;
alter table public.glam_service_categories enable row level security;
alter table public.glam_service_subcategories enable row level security;
alter table public.glam_service_variants enable row level security;

-- Catalog tables are read-only to API roles. Writes use the checked RPCs.
revoke all on table public.glam_services, public.glam_service_categories,
  public.glam_service_subcategories, public.glam_service_variants from public,anon,authenticated;
grant select on table public.glam_services, public.glam_service_categories,
  public.glam_service_subcategories, public.glam_service_variants to anon,authenticated;

-- Permissive policies establish the intended read path. Restrictive policies
-- impose the same ceiling on ALL older permissive policies (which combine OR).
-- Keep older policies intact; no assumptions about their names or removal.
create policy catalog_categories_read on public.glam_service_categories
for select to anon,authenticated
using (glam_private.catalog_row_visible(organization_id,active));
create policy catalog_categories_ceiling on public.glam_service_categories
as restrictive for select to anon,authenticated
using (glam_private.catalog_row_visible(organization_id,active));

create policy catalog_subcategories_read on public.glam_service_subcategories
for select to anon,authenticated
using (glam_private.catalog_row_visible(organization_id,active and exists (
  select 1 from public.glam_service_categories c
  where c.id=category_id and c.organization_id=glam_service_subcategories.organization_id and c.active
)));
create policy catalog_subcategories_ceiling on public.glam_service_subcategories
as restrictive for select to anon,authenticated
using (glam_private.catalog_row_visible(organization_id,active and exists (
  select 1 from public.glam_service_categories c
  where c.id=category_id and c.organization_id=glam_service_subcategories.organization_id and c.active
)));

create policy catalog_services_read on public.glam_services
for select to anon,authenticated
using (glam_private.catalog_row_visible(organization_id,active
  and (category_id is null or exists (
    select 1 from public.glam_service_categories c
    where c.id=category_id and c.organization_id=glam_services.organization_id and c.active
  ))
  and (subcategory_id is null or exists (
    select 1 from public.glam_service_subcategories s
    where s.id=subcategory_id and s.category_id=glam_services.category_id
      and s.organization_id=glam_services.organization_id and s.active
  ))
));
create policy catalog_services_ceiling on public.glam_services
as restrictive for select to anon,authenticated
using (glam_private.catalog_row_visible(organization_id,active
  and (category_id is null or exists (
    select 1 from public.glam_service_categories c
    where c.id=category_id and c.organization_id=glam_services.organization_id and c.active
  ))
  and (subcategory_id is null or exists (
    select 1 from public.glam_service_subcategories s
    where s.id=subcategory_id and s.category_id=glam_services.category_id
      and s.organization_id=glam_services.organization_id and s.active
  ))
));

create policy catalog_variants_read on public.glam_service_variants
for select to anon,authenticated
using (exists (
  select 1 from public.glam_services s where s.id=service_id
    and glam_private.catalog_row_visible(s.organization_id,glam_service_variants.active and s.active)
));
create policy catalog_variants_ceiling on public.glam_service_variants
as restrictive for select to anon,authenticated
using (exists (
  select 1 from public.glam_services s where s.id=service_id
    and glam_private.catalog_row_visible(s.organization_id,glam_service_variants.active and s.active)
));

-- Invalidate the PostgREST cache after commit; no service IDs/data are rewritten.
notify pgrst, 'reload schema';
commit;
