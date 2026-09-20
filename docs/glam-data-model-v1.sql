-- Glam service and scheduling model v1
-- Prepared for review/application in the UAT Supabase project.

create table if not exists public.glam_service_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.glam_organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

alter table public.glam_services
  add column if not exists category_id uuid references public.glam_service_categories(id) on delete set null,
  add column if not exists pricing_mode text not null default 'fixed'
    check (pricing_mode in ('fixed', 'from', 'range', 'variants')),
  add column if not exists buffer_minutes integer not null default 0
    check (buffer_minutes between 0 and 120);

create table if not exists public.glam_service_variants (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.glam_services(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  price_sar numeric not null check (price_sar >= 0 and price_sar <= 10000),
  minutes integer not null check (minutes between 15 and 480 and minutes % 15 = 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.glam_appointments
  add column if not exists service_variant_id uuid references public.glam_service_variants(id) on delete set null,
  add column if not exists buffer_minutes integer not null default 0
    check (buffer_minutes between 0 and 120);

create index if not exists glam_service_categories_org_idx
  on public.glam_service_categories (organization_id, active, sort_order);
create index if not exists glam_service_variants_service_idx
  on public.glam_service_variants (service_id, active, sort_order);
create index if not exists glam_appointments_specialist_time_idx
  on public.glam_appointments (specialist_id, starts_at, ends_at);

-- Availability rule: a candidate slot is valid only when its full interval,
-- including the service buffer, does not overlap another confirmed reservation.
-- Application code must check:
-- existing.starts_at < candidate_ends_at
-- and existing.ends_at > candidate_starts_at
-- before inserting a reservation.
