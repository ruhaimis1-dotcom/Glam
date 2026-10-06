-- GLAM MVP G3 minimal compatibility migration candidate
-- PREPARED ONLY. DO NOT APPLY TO PRODUCTION UNTIL MVP DATABASE GATE IS APPROVED.
-- Purpose: expose role-aware team directory for owner/manager UI using the
-- existing membership/invite/service-assignment/schedule architecture.

begin;

create or replace function glam_private.business_team_directory(p_org uuid)
returns table(
  organization_id uuid,
  user_id uuid,
  display_name text,
  role text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.organization_id,
    m.user_id,
    coalesce(nullif(btrim(p.display_name), ''), 'عضو فريق') as display_name,
    m.role
  from public.glam_memberships m
  left join public.glam_profiles p on p.user_id = m.user_id
  where m.organization_id = p_org
    and m.role in ('owner','manager','specialist')
    and auth.uid() is not null
    and exists (
      select 1
      from public.glam_memberships mine
      where mine.organization_id = p_org
        and mine.user_id = auth.uid()
        and mine.role in ('owner','manager')
    )
  order by m.role, display_name
$$;

revoke all on function glam_private.business_team_directory(uuid) from public, anon;
grant execute on function glam_private.business_team_directory(uuid) to authenticated;

create or replace function public.glam_business_team_directory(p_org uuid)
returns table(
  organization_id uuid,
  user_id uuid,
  display_name text,
  role text
)
language sql
stable
set search_path = ''
as $$ select * from glam_private.business_team_directory(p_org) $$;

revoke all on function public.glam_business_team_directory(uuid) from public, anon;
grant execute on function public.glam_business_team_directory(uuid) to authenticated;

commit;
