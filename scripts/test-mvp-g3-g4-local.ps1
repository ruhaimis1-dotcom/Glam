param(
  [string]$Snapshot = 'supabase/.temp/glam-schema-only.sql',
  [string]$ExpectedSha256 = '390756903381B1E8DA2DCEE4AB5B6CF9BCD32419E2D424C601B4A0D2B525D91E'
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $repo

$docker = (Get-Command docker.exe -ErrorAction SilentlyContinue).Source
if (-not $docker) { $docker = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin/docker.exe' }
if (-not (Test-Path -LiteralPath $docker)) { throw 'Docker CLI not found.' }

$snapshotPath = (Resolve-Path -LiteralPath $Snapshot).Path
if ((Get-FileHash -LiteralPath $snapshotPath -Algorithm SHA256).Hash -ne $ExpectedSha256) {
  throw 'Snapshot hash mismatch. Stop and review the replacement snapshot.'
}

$container = 'glam-pr4-review'
$image = 'public.ecr.aws/supabase/postgres:17.6.1.166'

function Invoke-LocalDocker([string[]]$Arguments) {
  & $docker @Arguments
  if ($LASTEXITCODE -ne 0) { throw ('Local Docker command failed: ' + $Arguments[0]) }
}

function Invoke-PsqlFile(
  [string]$Path,
  [string]$Database,
  [string]$User,
  [switch]$SingleTransaction
) {
  $resolved = (Resolve-Path -LiteralPath $Path).Path
  $arguments = @('exec','-i',$container,'psql','-X','-U',$User,'-d',$Database,'-v','ON_ERROR_STOP=1')
  if ($SingleTransaction) { $arguments += '-1' }

  # Do not use docker cp here. The reviewed recovery path streams SQL over stdin
  # directly into psql, avoiding the previously failed container-copy path.
  $process = Start-Process -FilePath $docker -ArgumentList $arguments `
    -RedirectStandardInput $resolved -Wait -PassThru -NoNewWindow
  if ($process.ExitCode -ne 0) {
    throw ('Local psql stream failed for: ' + $resolved)
  }
}

$names = & $docker ps -a --format '{{.Names}}'
if ($LASTEXITCODE -ne 0) { throw 'Docker is unavailable.' }
if ($container -notin $names) { throw 'Expected isolated container glam-pr4-review was not found.' }

$info = (& $docker inspect $container | ConvertFrom-Json)[0]
if ($info.HostConfig.NetworkMode -ne 'none' -or
    @($info.HostConfig.PortBindings.PSObject.Properties).Count -ne 0 -or
    $info.Config.Image -ne $image) {
  throw 'Refusing target: container isolation/image no longer matches the reviewed GLAM environment.'
}

if (-not $info.State.Running) { Invoke-LocalDocker @('start',$container) }

$ready = $false
for ($attempt=0; $attempt -lt 30; $attempt++) {
  & $docker exec $container pg_isready -U supabase_admin *> $null
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  Start-Sleep -Seconds 1
}
if (-not $ready) { throw 'Isolated GLAM PostgreSQL did not become ready.' }

$database = 'mvp_g3g4_' + [Guid]::NewGuid().ToString('N')
Invoke-LocalDocker @('exec',$container,'createdb','-U','supabase_admin','-O','postgres','-T','template0',$database)

Write-Output ('Restoring reviewed GLAM snapshot into isolated database ' + $database)
Invoke-PsqlFile -Path $snapshotPath -Database $database -User 'supabase_admin' -SingleTransaction

$migrations = @(
  'docs/sql/mvp/20261006_000_g3_team_directory_compat.sql',
  'docs/sql/mvp/20261006_001_beauty_passport_minimal.sql',
  'docs/sql/mvp/20261006_002_client_360_minimal.sql'
)
foreach ($file in $migrations) {
  Write-Output ('Applying rehearsal SQL only: ' + $file)
  Invoke-PsqlFile -Path (Join-Path $repo $file) -Database $database -User 'postgres'
}
Write-Output 'PASS: isolated G3/G4 migration rehearsal completed.'

Write-Output 'Running schema / RLS / ACL / RPC configuration assertions.'
Invoke-PsqlFile `
  -Path (Join-Path $repo 'docs/sql/mvp/20261006_negative_security_rehearsal.sql') `
  -Database $database -User 'postgres' -SingleTransaction
Write-Output 'PASS: static database security configuration assertions completed.'

$summary = & $docker exec $container psql -X -U supabase_admin -d $database -At -c @'
select json_build_object(
  'database', current_database(),
  'beauty_passports', to_regclass('public.glam_beauty_passports') is not null,
  'passport_consents', to_regclass('public.glam_passport_consents') is not null,
  'client_contacts', to_regclass('public.glam_client_contacts') is not null,
  'parallel_staff_model', (
    to_regclass('public.glam_staff') is not null
    or to_regclass('public.glam_staff_services') is not null
    or to_regclass('public.glam_staff_availability') is not null
  ),
  'team_directory_rpc', to_regprocedure('public.glam_business_team_directory(uuid)') is not null,
  'passport_list_rpc', to_regprocedure('public.glam_my_passport_consents()') is not null,
  'client_create_rpc', to_regprocedure('public.glam_create_client_contact(uuid,text,text,text)') is not null
);
'@
if ($LASTEXITCODE -ne 0) { throw 'Unable to read rehearsal summary.' }

Write-Output 'NOT RUN: runtime authenticated cross-tenant / cross-customer isolation.'
Write-Output 'Runtime isolation requires two authenticated test identities and must be evidenced separately before G4 can be closed.'
Write-Output ('Database retained for inspection: ' + $database)
Write-Output $summary
