-- PROPOSAL ONLY. Not runnable before MVP Gate.
begin;

create table public.glam_client_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.glam_organizations(id) on delete cascade,
  linked_customer_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  phone text,
  email text,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.glam_client_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.glam_organizations(id) on delete cascade,
  contact_id uuid not null references public.glam_client_contacts(id) on delete cascade,
  author_user_id uuid not null references auth.users(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table public.glam_client_tags (
  organization_id uuid not null references public.glam_organizations(id) on delete cascade,
  contact_id uuid not null references public.glam_client_contacts(id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, contact_id, tag)
);

create table public.glam_client_followups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.glam_organizations(id) on delete cascade,
  contact_id uuid not null references public.glam_client_contacts(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete set null,
  due_at timestamptz not null,
  reason text not null,
  status text not null default 'open' check (status in ('open','done','cancelled')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.glam_client_communications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.glam_organizations(id) on delete cascade,
  contact_id uuid not null references public.glam_client_contacts(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id),
  channel text not null check (channel in ('phone','whatsapp','sms','email','in_person','other')),
  direction text not null check (direction in ('inbound','outbound')),
  outcome text,
  created_at timestamptz not null default now()
);

-- RLS and tenant-safe composite FK strategy must be finalized against live baseline.
-- No Beauty Passport columns are permitted in these CRM tables.
rollback;
