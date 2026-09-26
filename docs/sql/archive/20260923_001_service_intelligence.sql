-- ARCHIVED PROPOSAL ONLY. Incompatible with live GLAM; never run as a migration.
-- GLAM P1 Service Intelligence
-- Additive/backward-compatible foundation. No destructive legacy changes.

create extension if not exists pgcrypto;

create table if not exists public.glam_service_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  parent_id uuid references public.glam_service_categories(id) on delete set null,
  name_ar text not null,
  name_en text,
  slug text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.glam_services
  add column if not exists organization_id uuid,
  add column if not exists category_id uuid references public.glam_service_categories(id) on delete set null,
  add column if not exists name_ar text,
  add column if not exists name_en text,
  add column if not exists description_ar text,
  add column if not exists description_en text,
  add column if not exists status text not null default 'draft',
  add column if not exists pricing_mode text not null default 'fixed',
  add column if not exists base_price_sar numeric(10,2),
  add column if not exists duration_minutes integer,
  add column if not exists prep_buffer_minutes integer not null default 0,
  add column if not exists cleanup_buffer_minutes integer not null default 0,
  add column if not exists intelligence_notes text,
  add column if not exists female_professional_required boolean not null default false,
  add column if not exists private_room_supported boolean not null default false,
  add column if not exists private_room_required boolean not null default false,
  add column if not exists photography_policy text not null default 'salon_policy',
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.glam_services add constraint glam_services_status_check
    check (status in ('draft','active','archived'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.glam_services add constraint glam_services_pricing_mode_check
    check (pricing_mode in ('fixed','starts_from','variants'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.glam_services add constraint glam_services_photography_policy_check
    check (photography_policy in ('salon_policy','allowed_with_consent','prohibited'));
exception when duplicate_object then null; end $$;

create table if not exists public.glam_service_variants (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.glam_services(id) on delete cascade,
  name_ar text not null,
  name_en text,
  price_sar numeric(10,2),
  duration_minutes integer,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.glam_service_profile_rules (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.glam_services(id) on delete cascade,
  dimension text not null check (dimension in ('hair','skin','nails')),
  attribute_key text not null,
  operator text not null check (operator in ('supports','prefers','excludes','warns')),
  attribute_value text not null,
  severity text not null default 'info' check (severity in ('info','warning','block')),
  note_ar text,
  note_en text
);

create table if not exists public.glam_service_sensitivities (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.glam_services(id) on delete cascade,
  ingredient_or_product text not null,
  rule text not null check (rule in ('contains','may_contain','avoid')),
  note_ar text,
  note_en text
);

create table if not exists public.glam_service_products (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.glam_services(id) on delete cascade,
  product_name text not null,
  requirement text not null default 'optional' check (requirement in ('required','preferred','optional')),
  usage_note text
);

create index if not exists glam_service_categories_org_idx on public.glam_service_categories(organization_id);
create index if not exists glam_services_org_idx on public.glam_services(organization_id);
create index if not exists glam_services_category_idx on public.glam_services(category_id);
create index if not exists glam_service_variants_service_idx on public.glam_service_variants(service_id);
create index if not exists glam_service_profile_rules_service_idx on public.glam_service_profile_rules(service_id);
create index if not exists glam_service_sensitivities_service_idx on public.glam_service_sensitivities(service_id);
create index if not exists glam_service_products_service_idx on public.glam_service_products(service_id);

-- Safe legacy backfill where the historical columns exist.
do $$ begin
  update public.glam_services set name_ar = name where name_ar is null and name is not null;
exception when undefined_column then null; end $$;
do $$ begin
  update public.glam_services set base_price_sar = price_sar where base_price_sar is null and price_sar is not null;
exception when undefined_column then null; end $$;
do $$ begin
  update public.glam_services set base_price_sar = price where base_price_sar is null and price is not null;
exception when undefined_column then null; end $$;

-- RLS is enabled now; mutation policies are intentionally added only after
-- the project's authoritative membership table is confirmed.
alter table public.glam_service_categories enable row level security;
alter table public.glam_service_variants enable row level security;
alter table public.glam_service_profile_rules enable row level security;
alter table public.glam_service_sensitivities enable row level security;
alter table public.glam_service_products enable row level security;
