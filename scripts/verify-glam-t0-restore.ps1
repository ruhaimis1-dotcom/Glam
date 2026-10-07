param(
  [string]$EncryptedArtifact,
  [string]$Snapshot = 'supabase/.temp/glam-schema-only.sql'
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repo = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $repo

function Require-Command([string]$Name) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $cmd) { throw "$Name is required and was not found in PATH." }
  return $cmd.Source
}

$gpg = Require-Command 'gpg'
$tar = Require-Command 'tar'

$docker = (Get-Command docker.exe -ErrorAction SilentlyContinue).Source
if (-not $docker) { $docker = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin/docker.exe' }
if (-not (Test-Path -LiteralPath $docker)) { throw 'Docker CLI not found.' }

$container = 'glam-pr4-review'
$image = 'public.ecr.aws/supabase/postgres:17.6.1.166'
$expectedSnapshotHash = '390756903381B1E8DA2DCEE4AB5B6CF9BCD32419E2D424C601B4A0D2B525D91E'

if (-not $EncryptedArtifact) {
  $latest = Get-ChildItem -LiteralPath (Join-Path $repo 'supabase/.temp/t0') -Filter '*.zip.gpg' -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if (-not $latest) { throw 'No encrypted GLAM T0 artifact found.' }
  $EncryptedArtifact = $latest.FullName
}

$encrypted = (Resolve-Path -LiteralPath $EncryptedArtifact).Path
$hashFile = $encrypted + '.sha256.txt'
if (-not (Test-Path -LiteralPath $hashFile)) { throw 'Missing SHA-256 sidecar for encrypted artifact.' }

$expectedEncryptedHash = ((Get-Content -LiteralPath $hashFile -Raw).Trim() -split '\s+')[0].ToUpperInvariant()
$actualEncryptedHash = (Get-FileHash -LiteralPath $encrypted -Algorithm SHA256).Hash.ToUpperInvariant()
if ($actualEncryptedHash -ne $expectedEncryptedHash) {
  throw 'Encrypted artifact SHA-256 mismatch.'
}
Write-Output 'PASS: encrypted artifact SHA-256 matches sidecar.'

$snapshotPath = (Resolve-Path -LiteralPath $Snapshot).Path
if ((Get-FileHash -LiteralPath $snapshotPath -Algorithm SHA256).Hash -ne $expectedSnapshotHash) {
  throw 'Reviewed GLAM schema snapshot hash mismatch.'
}
Write-Output 'PASS: reviewed local GLAM schema snapshot hash matches.'

$names = & $docker ps -a --format '{{.Names}}'
if ($LASTEXITCODE -ne 0) { throw 'Docker is unavailable.' }
if ($container -notin $names) { throw 'Expected isolated container glam-pr4-review was not found.' }

$info = (& $docker inspect $container | ConvertFrom-Json)[0]
if ($info.HostConfig.NetworkMode -ne 'none' -or
    @($info.HostConfig.PortBindings.PSObject.Properties).Count -ne 0 -or
    $info.Config.Image -ne $image) {
  throw 'Refusing target: isolated container no longer matches the reviewed GLAM environment.'
}
if (-not $info.State.Running) {
  & $docker start $container | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Unable to start isolated GLAM PostgreSQL container.' }
}

$runId = [Guid]::NewGuid().ToString('N')
$tempRoot = Join-Path $repo ('supabase/.temp/t0-restore-' + $runId)
$zip = Join-Path $tempRoot 't0.zip'
$extract = Join-Path $tempRoot 'extract'
$filteredData = Join-Path $tempRoot 'application-data.sql'
$wrapper = Join-Path $tempRoot 'data-wrapper.sql'
New-Item -ItemType Directory -Force -Path $extract | Out-Null

function Invoke-PsqlFile([string]$Path,[string]$Database,[string]$User='supabase_admin',[switch]$SingleTransaction) {
  $resolved = (Resolve-Path -LiteralPath $Path).Path
  $args = @('exec','-i',$container,'psql','-X','-U',$User,'-d',$Database,'-v','ON_ERROR_STOP=1')
  if ($SingleTransaction) { $args += '-1' }
  $p = Start-Process -FilePath $docker -ArgumentList $args -RedirectStandardInput $resolved -Wait -PassThru -NoNewWindow
  if ($p.ExitCode -ne 0) { throw ('psql restore failed for: ' + $resolved) }
}

try {
  Write-Host 'Decrypting T0 artifact. Enter the GnuPG passphrase only in the Pinentry prompt.'
  & $gpg --output $zip --decrypt $encrypted
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $zip)) { throw 'GnuPG decryption failed.' }

  & $tar -xf $zip -C $extract
  if ($LASTEXITCODE -ne 0) { throw 'Unable to extract decrypted T0 archive.' }

  $manifestPath = Join-Path $extract 'manifest.json'
  $roles = Join-Path $extract 'roles.sql'
  $schema = Join-Path $extract 'schema.sql'
  $data = Join-Path $extract 'data.sql'
  foreach ($path in @($manifestPath,$roles,$schema,$data)) {
    if (-not (Test-Path -LiteralPath $path)) { throw ('Missing decrypted T0 file: ' + $path) }
  }

  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  if ($manifest.projectRef -ne 'tevqysdswqkgqartpzdg') { throw 'T0 manifest project ref is not GLAM.' }

  foreach ($entry in $manifest.files) {
    $path = Join-Path $extract $entry.name
    if (-not (Test-Path -LiteralPath $path)) { throw ('Manifest file missing: ' + $entry.name) }
    $actual = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
    if ($actual -ne $entry.sha256) { throw ('Manifest SHA-256 mismatch: ' + $entry.name) }
  }
  Write-Output 'PASS: decrypted T0 manifest and file hashes verified.'

  $database = 't0_restore_' + $runId
  & $docker exec $container createdb -U supabase_admin -O postgres -T template0 $database
  if ($LASTEXITCODE -ne 0) { throw 'Unable to create isolated T0 restore database.' }

  Write-Host ('Restoring reviewed GLAM baseline schema into isolated database ' + $database)
  Invoke-PsqlFile -Path $snapshotPath -Database $database -User 'supabase_admin' -SingleTransaction

  # The Supabase CLI data dump can contain managed Storage table COPY blocks even
  # though this Application T0 intentionally does not restore the managed Storage
  # schema or Storage objects. Remove only executable storage COPY/setval entries;
  # preserve every application row exactly as exported.
  $inputLines = Get-Content -LiteralPath $data
  $outputLines = [System.Collections.Generic.List[string]]::new()
  $skippingStorageCopy = $false
  $storageCopyBlocks = 0
  $storageSetvalLines = 0

  foreach ($line in $inputLines) {
    if (-not $skippingStorageCopy -and $line -match '^\s*COPY\s+(?:"storage"|storage)\.') {
      $skippingStorageCopy = $true
      $storageCopyBlocks++
      continue
    }

    if ($skippingStorageCopy) {
      if ($line -eq '\.') { $skippingStorageCopy = $false }
      continue
    }

    if ($line -match "^\s*SELECT\s+(?:pg_catalog\.)?setval\('\"?storage\"?\.") {
      $storageSetvalLines++
      continue
    }

    $outputLines.Add($line)
  }

  if ($skippingStorageCopy) {
    throw 'Malformed data dump: unterminated storage COPY block.'
  }

  $outputLines | Set-Content -LiteralPath $filteredData -Encoding UTF8
  $filteredText = Get-Content -LiteralPath $filteredData -Raw

  $remainingStorageExec = @(
    [regex]::Matches(
      $filteredText,
      '(?im)^\s*(?:COPY\s+(?:"storage"|storage)\.|SELECT\s+(?:pg_catalog\.)?setval\(''\"?storage\"?\.)[^\r\n]*'
    ) | ForEach-Object { $_.Value.Trim() }
  )
  if ($remainingStorageExec.Count -gt 0) {
    Write-Host 'Remaining managed Storage statements:' -ForegroundColor Yellow
    $remainingStorageExec | Select-Object -First 10 | ForEach-Object { Write-Host $_ -ForegroundColor Yellow }
    throw 'Managed Storage executable data remained after filtering; restore was not attempted.'
  }

  Write-Output ('INFO: excluded managed Storage COPY blocks: ' + $storageCopyBlocks)
  Write-Output ('INFO: excluded managed Storage setval statements: ' + $storageSetvalLines)

  $wrapped = @"
BEGIN;
SET LOCAL session_replication_role = replica;
$filteredText
SET LOCAL session_replication_role = origin;
COMMIT;
"@
  Set-Content -LiteralPath $wrapper -Value $wrapped -Encoding UTF8

  Write-Host 'Restoring application data with triggers disabled inside one transaction.'
  Invoke-PsqlFile -Path $wrapper -Database $database -User 'supabase_admin'

  $fingerprintSql = @'
select jsonb_build_object(
  'organizations', jsonb_build_object(
    'count',(select count(*) from public.glam_organizations),
    'idset_md5',(select md5(coalesce(string_agg(id::text,',' order by id),'')) from public.glam_organizations)
  ),
  'memberships', jsonb_build_object(
    'count',(select count(*) from public.glam_memberships),
    'idset_md5',(select md5(coalesce(string_agg((organization_id::text||':'||user_id::text||':'||role),',' order by organization_id,user_id,role),'')) from public.glam_memberships)
  ),
  'services', jsonb_build_object(
    'count',(select count(*) from public.glam_services),
    'idset_md5',(select md5(coalesce(string_agg(id::text,',' order by id),'')) from public.glam_services)
  ),
  'appointments', jsonb_build_object(
    'count',(select count(*) from public.glam_appointments),
    'idset_md5',(select md5(coalesce(string_agg(id::text,',' order by id),'')) from public.glam_appointments)
  ),
  'reservations', jsonb_build_object(
    'count',(select count(*) from public.glam_reservations),
    'idset_md5',(select md5(coalesce(string_agg(id::text,',' order by id),'')) from public.glam_reservations)
  ),
  'service_specialists', jsonb_build_object(
    'count',(select count(*) from public.glam_service_specialists),
    'idset_md5',(select md5(coalesce(string_agg((service_id::text||':'||specialist_id::text),',' order by service_id,specialist_id),'')) from public.glam_service_specialists)
  ),
  'schedule_windows', jsonb_build_object(
    'count',(select count(*) from public.glam_schedule_windows),
    'idset_md5',(select md5(coalesce(string_agg(id::text,',' order by id),'')) from public.glam_schedule_windows)
  )
);
'@
  $fingerprint = & $docker exec $container psql -X -U supabase_admin -d $database -At -c $fingerprintSql
  if ($LASTEXITCODE -ne 0) { throw 'Unable to read restored T0 fingerprint.' }

  Write-Output 'PASS: GLAM application T0 restored into isolated PostgreSQL.'
  Write-Output ('Database retained for inspection: ' + $database)
  Write-Output 'RESTORED_FINGERPRINT:'
  Write-Output $fingerprint
  Write-Output 'LIMITATION: Auth/Storage managed schemas and Storage objects are not restored from this application T0 artifact.'
  Write-Output 'LIMITATION: auth.users rows are not part of the Supabase CLI data dump; FK enforcement was disabled only during local application-data restore.'
}
finally {
  if (Test-Path -LiteralPath $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
