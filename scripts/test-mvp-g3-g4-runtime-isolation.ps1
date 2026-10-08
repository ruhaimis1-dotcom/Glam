param(
  [Parameter(Mandatory = $true)]
  [string]$Database
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $repo

$docker = (Get-Command docker.exe -ErrorAction SilentlyContinue).Source
if (-not $docker) { $docker = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin/docker.exe' }
if (-not (Test-Path -LiteralPath $docker)) { throw 'Docker CLI not found.' }

$container = 'glam-pr4-review'
$image = 'public.ecr.aws/supabase/postgres:17.6.1.166'

$names = & $docker ps -a --format '{{.Names}}'
if ($LASTEXITCODE -ne 0) { throw 'Docker is unavailable.' }
if ($container -notin $names) { throw 'Expected isolated container glam-pr4-review was not found.' }

$info = (& $docker inspect $container | ConvertFrom-Json)[0]
if ($info.HostConfig.NetworkMode -ne 'none' -or
    @($info.HostConfig.PortBindings.PSObject.Properties).Count -ne 0 -or
    $info.Config.Image -ne $image) {
  throw 'Refusing target: container isolation/image no longer matches the reviewed GLAM environment.'
}

if (-not $info.State.Running) {
  & $docker start $container | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Unable to start isolated GLAM PostgreSQL container.' }
}

$exists = & $docker exec $container psql -X -U supabase_admin -d postgres -At -c "select 1 from pg_database where datname = '$Database';"
if ($LASTEXITCODE -ne 0 -or $exists.Trim() -ne '1') {
  throw ('Isolated rehearsal database not found: ' + $Database)
}

$tempDir = Join-Path $repo 'supabase/.temp'
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
$sqlPath = Join-Path $tempDir ('g3-g4-runtime-isolation-' + [Guid]::NewGuid().ToString('N') + '.sql')

$sql = @'
\set ON_ERROR_STOP on
begin;
set local statement_timeout = '30s';

create temp table runtime_iso_fixture as
select
  gen_random_uuid() owner_a,
  gen_random_uuid() owner_b,
  gen_random_uuid() customer_a,
  gen_random_uuid() customer_b,
  gen_random_uuid() org_a,
  gen_random_uuid() org_b,
  gen_random_uuid() contact_a,
  gen_random_uuid() contact_b,
  gen_random_uuid() consent_a,
  gen_random_uuid() consent_b;

grant select on runtime_iso_fixture to authenticated;

insert into auth.users(id)
select owner_a from runtime_iso_fixture
union all select owner_b from runtime_iso_fixture
union all select customer_a from runtime_iso_fixture
union all select customer_b from runtime_iso_fixture;

insert into public.glam_organizations(id,name,status)
select org_a,'G4 isolation salon A','active' from runtime_iso_fixture
union all
select org_b,'G4 isolation salon B','active' from runtime_iso_fixture;

insert into public.glam_memberships(organization_id,user_id,role)
select org_a,owner_a,'owner' from runtime_iso_fixture
union all
select org_b,owner_b,'owner' from runtime_iso_fixture;

insert into public.glam_beauty_passports(customer_id,hair,skin,nails,sensitivities,preferences,customer_notes)
select customer_a,
       '{"type":"A"}'::jsonb,
       '{}'::jsonb,
       '{}'::jsonb,
       '["A-only"]'::jsonb,
       '{"pref":"A"}'::jsonb,
       'A private passport'
from runtime_iso_fixture
union all
select customer_b,
       '{"type":"B"}'::jsonb,
       '{}'::jsonb,
       '{}'::jsonb,
       '["B-only"]'::jsonb,
       '{"pref":"B"}'::jsonb,
       'B private passport'
from runtime_iso_fixture;

insert into public.glam_passport_consents(
  id, customer_id, organization_id, scopes, consent_version, granted_at
)
select consent_a,customer_a,org_a,array['profile','sensitivities']::text[],1,now()
from runtime_iso_fixture
union all
select consent_b,customer_b,org_b,array['profile']::text[],1,now()
from runtime_iso_fixture;

insert into public.glam_client_contacts(
  id, organization_id, linked_customer_id, display_name, phone, email, source
)
select contact_a,org_a,customer_a,'Client A','0500000001','client-a@example.test','runtime-test'
from runtime_iso_fixture
union all
select contact_b,org_b,customer_b,'Client B','0500000002','client-b@example.test','runtime-test'
from runtime_iso_fixture;

-- Owner A: own tenant visible, tenant B hidden, forged org arguments fail closed.
select set_config('request.jwt.claim.sub',owner_a::text,true) from runtime_iso_fixture;
set local role authenticated;
do $$
declare f record; created uuid;
begin
  select * into f from runtime_iso_fixture;

  if (select count(*) from public.glam_client_contacts) <> 1
     or not exists(select 1 from public.glam_client_contacts where id=f.contact_a)
     or exists(select 1 from public.glam_client_contacts where id=f.contact_b) then
    raise exception 'OWNER_A_CLIENT_CONTACT_ISOLATION_FAILED';
  end if;

  if not exists(
    select 1 from public.glam_business_team_directory(f.org_a)
    where user_id=f.owner_a and role='owner'
  ) then
    raise exception 'OWNER_A_TEAM_DIRECTORY_OWN_TENANT_MISSING';
  end if;

  if exists(select 1 from public.glam_business_team_directory(f.org_b)) then
    raise exception 'OWNER_A_TEAM_DIRECTORY_CROSS_TENANT_EXPOSED';
  end if;

  if exists(
    select 1 from public.glam_find_client_contact_duplicates(
      f.org_b,'0500000002','client-b@example.test'
    )
  ) then
    raise exception 'OWNER_A_DUPLICATE_RPC_CROSS_TENANT_EXPOSED';
  end if;

  begin
    created := public.glam_create_client_contact(
      f.org_b,'Forged B','0500000999','forged-b@example.test'
    );
    raise exception 'OWNER_A_FORGED_ORG_CREATE_ALLOWED';
  exception
    when insufficient_privilege then null;
  end;

  if exists(select 1 from public.glam_client_timeline(f.org_b,f.contact_b)) then
    raise exception 'OWNER_A_TIMELINE_CROSS_TENANT_EXPOSED';
  end if;
end
$$;
reset role;

-- Owner B: symmetric read isolation.
select set_config('request.jwt.claim.sub',owner_b::text,true) from runtime_iso_fixture;
set local role authenticated;
do $$
declare f record;
begin
  select * into f from runtime_iso_fixture;
  if (select count(*) from public.glam_client_contacts) <> 1
     or not exists(select 1 from public.glam_client_contacts where id=f.contact_b)
     or exists(select 1 from public.glam_client_contacts where id=f.contact_a) then
    raise exception 'OWNER_B_CLIENT_CONTACT_ISOLATION_FAILED';
  end if;
end
$$;
reset role;

-- Customer A: passport ownership + consent ownership/revocation.
select set_config('request.jwt.claim.sub',customer_a::text,true) from runtime_iso_fixture;
set local role authenticated;
do $$
declare f record; revoked uuid;
begin
  select * into f from runtime_iso_fixture;

  if not exists(select 1 from public.glam_beauty_passports where customer_id=f.customer_a)
     or exists(select 1 from public.glam_beauty_passports where customer_id=f.customer_b) then
    raise exception 'CUSTOMER_A_PASSPORT_ISOLATION_FAILED';
  end if;

  if (select count(*) from public.glam_my_passport_consents()) <> 1
     or not exists(
       select 1 from public.glam_my_passport_consents()
       where id=f.consent_a and organization_id=f.org_a
     ) then
    raise exception 'CUSTOMER_A_CONSENT_LIST_ISOLATION_FAILED';
  end if;

  begin
    revoked := public.glam_revoke_passport_consent(f.consent_b);
    raise exception 'CUSTOMER_A_REVOKED_CUSTOMER_B_CONSENT';
  exception
    when raise_exception then
      if sqlerrm <> 'NOT_FOUND' then raise; end if;
  end;

  revoked := public.glam_revoke_passport_consent(f.consent_a);
  if revoked <> f.consent_a then
    raise exception 'CUSTOMER_A_OWN_CONSENT_REVOKE_FAILED';
  end if;

  if exists(select 1 from public.glam_my_passport_consents() where id=f.consent_a) then
    raise exception 'REVOKED_CONSENT_STILL_VISIBLE';
  end if;

  if exists(select 1 from public.glam_client_contacts) then
    raise exception 'CUSTOMER_A_CLIENT_CONTACTS_EXPOSED';
  end if;

  if exists(select 1 from public.glam_business_team_directory(f.org_a)) then
    raise exception 'CUSTOMER_A_TEAM_DIRECTORY_EXPOSED';
  end if;

  begin
    perform public.glam_create_client_contact(
      f.org_a,'Denied','0500000888','denied@example.test'
    );
    raise exception 'CUSTOMER_A_CLIENT_CREATE_ALLOWED';
  exception
    when insufficient_privilege then null;
  end;
end
$$;
reset role;

-- Customer B remains unaffected by A's revoke.
select set_config('request.jwt.claim.sub',customer_b::text,true) from runtime_iso_fixture;
set local role authenticated;
do $$
declare f record;
begin
  select * into f from runtime_iso_fixture;
  if not exists(select 1 from public.glam_beauty_passports where customer_id=f.customer_b)
     or exists(select 1 from public.glam_beauty_passports where customer_id=f.customer_a) then
    raise exception 'CUSTOMER_B_PASSPORT_ISOLATION_FAILED';
  end if;

  if (select count(*) from public.glam_my_passport_consents()) <> 1
     or not exists(select 1 from public.glam_my_passport_consents() where id=f.consent_b) then
    raise exception 'CUSTOMER_B_CONSENT_CHANGED_BY_CUSTOMER_A';
  end if;
end
$$;
reset role;

select set_config('request.jwt.claim.sub','',true);
rollback;

\echo PASS: runtime authenticated G3/G4 tenant and customer isolation assertions completed.
\echo NOTE: salon-side Beauty Passport read is not enabled in this MVP, so revocation is validated on the customer consent contract only.
'@

Set-Content -LiteralPath $sqlPath -Value $sql -Encoding UTF8
try {
  $arguments = @(
    'exec','-i',$container,
    'psql','-X','-U','postgres','-d',$Database,'-v','ON_ERROR_STOP=1'
  )
  $process = Start-Process -FilePath $docker -ArgumentList $arguments `
    -RedirectStandardInput $sqlPath -Wait -PassThru -NoNewWindow
  if ($process.ExitCode -ne 0) {
    throw 'Runtime tenant/customer isolation assertions failed.'
  }
  Write-Output 'PASS: G4 runtime isolation gate completed on the isolated rehearsal database.'
  Write-Output ('Database tested: ' + $Database)
}
finally {
  Remove-Item -LiteralPath $sqlPath -Force -ErrorAction SilentlyContinue
}
