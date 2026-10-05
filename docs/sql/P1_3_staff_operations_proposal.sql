-- PROPOSAL ONLY; intentionally outside supabase/migrations until MVP release gate.
-- PREPARED ONLY; NOT APPLIED TO PRODUCTION.
-- P1.3 GLAM Business staff operations. Apply only after release preflight.
begin;

create table if not exists public.glam_staff (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.glam_organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  specialty text not null check (char_length(trim(specialty)) between 2 and 120),
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists glam_staff_organization_idx
  on public.glam_staff (organization_id, active, name);

alter table public.glam_staff enable row level security;

create policy "business staff read"
on public.glam_staff for select to authenticated
using (exists (
  select 1 from public.glam_memberships m
  where m.organization_id = glam_staff.organization_id
    and m.user_id = auth.uid()
    and m.role in ('owner','manager')
));

create policy "business staff insert"
on public.glam_staff for insert to authenticated
with check (exists (
  select 1 from public.glam_memberships m
  where m.organization_id = glam_staff.organization_id
    and m.user_id = auth.uid()
    and m.role in ('owner','manager')
));

create policy "business staff update"
on public.glam_staff for update to authenticated
using (exists (
  select 1 from public.glam_memberships m
  where m.organization_id = glam_staff.organization_id
    and m.user_id = auth.uid()
    and m.role in ('owner','manager')
))
with check (exists (
  select 1 from public.glam_memberships m
  where m.organization_id = glam_staff.organization_id
    and m.user_id = auth.uid()
    and m.role in ('owner','manager')
));

grant select, insert, update on public.glam_staff to authenticated;
commit;
