-- GLAM MVP G3/G4 isolated rehearsal negative test pack
-- RUN ONLY on an isolated Supabase development branch after applying the prepared MVP migrations.
-- Never run on production.

begin;

-- This pack validates schema/security invariants that do not require real production users.
-- Runtime auth-role behavior is covered separately through SDK/HTTP tests on the branch.

do $$
begin
  if to_regclass('public.glam_beauty_passports') is null then
    raise exception 'MISSING: glam_beauty_passports';
  end if;
  if to_regclass('public.glam_passport_consents') is null then
    raise exception 'MISSING: glam_passport_consents';
  end if;
  if to_regclass('public.glam_client_contacts') is null then
    raise exception 'MISSING: glam_client_contacts';
  end if;

  -- G3 must reuse the live staff architecture.
  if to_regclass('public.glam_staff') is not null
     or to_regclass('public.glam_staff_services') is not null
     or to_regclass('public.glam_staff_availability') is not null then
    raise exception 'PARALLEL_STAFF_MODEL_DETECTED';
  end if;
end
$$;

-- All exposed MVP tables must have RLS.
do $$
declare missing text;
begin
  select string_agg(c.relname, ', ')
    into missing
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname in ('glam_beauty_passports','glam_passport_consents','glam_client_contacts')
    and c.relkind='r'
    and not c.relrowsecurity;

  if missing is not null then
    raise exception 'RLS_DISABLED: %', missing;
  end if;
end
$$;

-- Consent table must not be directly readable/writable by anon/authenticated.
do $$
begin
  if has_table_privilege('anon','public.glam_passport_consents','SELECT')
     or has_table_privilege('authenticated','public.glam_passport_consents','SELECT')
     or has_table_privilege('authenticated','public.glam_passport_consents','INSERT')
     or has_table_privilege('authenticated','public.glam_passport_consents','UPDATE')
     or has_table_privilege('authenticated','public.glam_passport_consents','DELETE') then
    raise exception 'PASSPORT_CONSENT_DIRECT_ACCESS_EXPOSED';
  end if;
end
$$;

-- Client contacts may be read under RLS but direct mutations must stay RPC-only.
do $$
begin
  if not has_table_privilege('authenticated','public.glam_client_contacts','SELECT') then
    raise exception 'CLIENT_CONTACT_READ_GRANT_MISSING';
  end if;
  if has_table_privilege('authenticated','public.glam_client_contacts','INSERT')
     or has_table_privilege('authenticated','public.glam_client_contacts','UPDATE')
     or has_table_privilege('authenticated','public.glam_client_contacts','DELETE') then
    raise exception 'CLIENT_CONTACT_DIRECT_MUTATION_EXPOSED';
  end if;
end
$$;

-- Public wrapper functions must not be executable by anon.
do $$
declare sig regprocedure;
begin
  foreach sig in array array[
    'public.glam_business_team_directory(uuid)'::regprocedure,
    'public.glam_my_passport_consents()'::regprocedure,
    'public.glam_revoke_passport_consent(uuid)'::regprocedure,
    'public.glam_find_client_contact_duplicates(uuid,text,text)'::regprocedure,
    'public.glam_create_client_contact(uuid,text,text,text)'::regprocedure,
    'public.glam_client_timeline(uuid,uuid)'::regprocedure
  ]
  loop
    if has_function_privilege('anon', sig, 'EXECUTE') then
      raise exception 'ANON_EXECUTE_EXPOSED: %', sig::text;
    end if;
    if not has_function_privilege('authenticated', sig, 'EXECUTE') then
      raise exception 'AUTH_EXECUTE_MISSING: %', sig::text;
    end if;
  end loop;
end
$$;

-- Private SECURITY DEFINER functions must not retain PUBLIC/anon execution.
do $$
declare sig regprocedure;
begin
  foreach sig in array array[
    'glam_private.business_team_directory(uuid)'::regprocedure,
    'glam_private.my_passport_consents()'::regprocedure,
    'glam_private.revoke_passport_consent(uuid)'::regprocedure,
    'glam_private.find_client_contact_duplicates(uuid,text,text)'::regprocedure,
    'glam_private.create_client_contact(uuid,text,text,text)'::regprocedure,
    'glam_private.client_timeline(uuid,uuid)'::regprocedure
  ]
  loop
    if has_function_privilege('PUBLIC', sig, 'EXECUTE')
       or has_function_privilege('anon', sig, 'EXECUTE') then
      raise exception 'PRIVATE_FUNCTION_EXECUTE_EXPOSED: %', sig::text;
    end if;
    if not has_function_privilege('authenticated', sig, 'EXECUTE') then
      raise exception 'PRIVATE_FUNCTION_AUTH_EXECUTE_MISSING: %', sig::text;
    end if;
  end loop;
end
$$;

-- Beauty Passport RLS must contain customer ownership predicates.
do $$
declare policies text;
begin
  select string_agg(coalesce(qual,'') || ' ' || coalesce(with_check,''), E'\n')
    into policies
  from pg_policies
  where schemaname='public' and tablename='glam_beauty_passports';

  if policies is null or position('auth.uid' in policies)=0 or position('customer_id' in policies)=0 then
    raise exception 'PASSPORT_OWNER_RLS_MISSING';
  end if;
end
$$;

-- Client contact RLS must reference organization membership.
do $$
declare policies text;
begin
  select string_agg(coalesce(qual,'') || ' ' || coalesce(with_check,''), E'\n')
    into policies
  from pg_policies
  where schemaname='public' and tablename='glam_client_contacts';

  if policies is null
     or position('glam_memberships' in policies)=0
     or position('organization_id' in policies)=0
     or position('owner' in policies)=0
     or position('manager' in policies)=0 then
    raise exception 'CLIENT_CONTACT_TENANT_RLS_MISSING';
  end if;
end
$$;

rollback;
