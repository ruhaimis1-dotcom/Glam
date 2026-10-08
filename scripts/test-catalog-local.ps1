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
  throw 'Snapshot hash mismatch. Review the new schema before approving its hash.'
}
$container = 'glam-pr4-review'
$image = 'public.ecr.aws/supabase/postgres:17.6.1.166'
function Invoke-LocalDocker([string[]]$Arguments) {
  & $docker @Arguments
  if ($LASTEXITCODE -ne 0) { throw ('Local Docker command failed: ' + $Arguments[0]) }
}
$names = & $docker ps -a --format '{{.Names}}'
if ($LASTEXITCODE -ne 0) { throw 'Docker is unavailable.' }
if ($container -notin $names) {
  Invoke-LocalDocker @('run','--detach','--name',$container,'--network','none','--env','POSTGRES_PASSWORD=local-pr4-fixture-only',$image)
}
$info = (& $docker inspect $container | ConvertFrom-Json)[0]
if ($LASTEXITCODE -ne 0 -or $info.HostConfig.NetworkMode -ne 'none' -or
    @($info.HostConfig.PortBindings.PSObject.Properties).Count -ne 0 -or $info.Config.Image -ne $image) {
  throw 'Refusing target: expected the isolated local PR4 container, no published ports, and the reviewed image.'
}
if (-not $info.State.Running) { Invoke-LocalDocker @('start',$container) }
$ready = $false
for ($attempt=0; $attempt -lt 30; $attempt++) {
  & $docker exec $container pg_isready -U supabase_admin *> $null
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  Start-Sleep -Seconds 1
}
if (-not $ready) { throw 'Local PostgreSQL did not become ready.' }
# Never reuse/drop an existing DB; each verification starts from template0.
$database = 'pr4_' + [Guid]::NewGuid().ToString('N')
Invoke-LocalDocker @('exec',$container,'createdb','-U','supabase_admin','-O','postgres','-T','template0',$database)
Invoke-LocalDocker @('cp',$snapshotPath,($container + ':/tmp/glam-schema-only.sql'))
Invoke-LocalDocker @('cp',(Join-Path $repo 'supabase/migrations/.'),($container + ':/tmp/migrations'))
Invoke-LocalDocker @('cp',(Join-Path $repo 'supabase/tests/.'),($container + ':/tmp/tests'))
Write-Output ('Restoring schema into local container ' + $container + ', database ' + $database)
Invoke-LocalDocker @('exec',$container,'psql','-X','-U','supabase_admin','-d',$database,'-v','ON_ERROR_STOP=1','-1','-f','/tmp/glam-schema-only.sql')
foreach ($migration in (Get-ChildItem -LiteralPath 'supabase/migrations' -Filter '*.sql' | Sort-Object Name)) {
  Write-Output ('Applying locally: ' + $migration.Name)
  Invoke-LocalDocker @('exec',$container,'psql','-X','-U','postgres','-d',$database,'-v','ON_ERROR_STOP=1','-f',('/tmp/migrations/' + $migration.Name))
}
Invoke-LocalDocker @('exec',$container,'psql','-X','-U','postgres','-d',$database,'-v','ON_ERROR_STOP=1','-f','/tmp/tests/catalog_contract.sql')
$counts = & $docker exec $container psql -X -U supabase_admin -d $database -At -c 'select (select count(*) from auth.users)+(select count(*) from public.glam_services)+(select count(*) from public.glam_reservations);'
if ($LASTEXITCODE -ne 0 -or ($counts -join '').Trim() -ne '0') { throw 'Test fixture rollback check failed.' }
Write-Output ('PASS: schema restore, all local migrations, catalog/booking/delivery SQL assertions, fixture rollback. Database: ' + $database)
