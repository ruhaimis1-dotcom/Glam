param(
  [string]$OutputRoot = 'supabase/.temp/t0'
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ProjectRef = 'tevqysdswqkgqartpzdg'
$repo = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $repo

function Require-Command([string]$Name) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $cmd) { throw "$Name is required and was not found in PATH." }
  return $cmd.Source
}

$gpg = Require-Command 'gpg'
$tar = Require-Command 'tar'

$supabaseGlobal = Get-Command supabase -ErrorAction SilentlyContinue
$npx = Get-Command npx -ErrorAction SilentlyContinue
if ($supabaseGlobal) {
  $supabaseMode = 'global'
  $supabase = $supabaseGlobal.Source
} elseif ($npx -and (Test-Path -LiteralPath (Join-Path $repo 'node_modules/supabase'))) {
  $supabaseMode = 'npx'
  $supabase = $npx.Source
} else {
  throw 'Supabase CLI not found. Install locally with: npm install supabase --save-dev'
}

function Invoke-Supabase([string[]]$Arguments) {
  if ($supabaseMode -eq 'global') {
    & $supabase @Arguments | Out-Host
  } else {
    & $supabase --no-install supabase @Arguments | Out-Host
  }
  $code = $LASTEXITCODE
  if ($null -eq $code) { $code = 0 }
  Write-Output ([int]$code)
}

# Fail before reading credentials if the required local tooling is unavailable.
if ($supabaseMode -eq 'global') {
  & $supabase --version | Out-Host
} else {
  & $supabase --no-install supabase --version | Out-Host
}
if ($LASTEXITCODE -ne 0) { throw 'Supabase CLI is unavailable.' }
$gpgVersionOutput = & $gpg --version
$gpgVersionExit = $LASTEXITCODE
if ($gpgVersionExit -ne 0) { throw 'GnuPG is unavailable.' }
$gpgVersionOutput | Select-Object -First 1 | Out-Host

Write-Host 'GLAM T0 logical export (read-only against production).'
Write-Host 'This uses Supabase CLI filtering. It DOES NOT claim a full managed-project backup.'
Write-Host 'Current Supabase CLI docs state managed schemas such as auth/storage are excluded.'
Write-Host 'Do not paste the connection string into chat or commit it to Git.'

$secure = Read-Host 'Paste the GLAM Session Pooler/direct PostgreSQL connection string' -AsSecureString
if ($secure.Length -eq 0) { throw 'Connection string is required.' }

$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$dbUrl = $null
try {
  $dbUrl = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

if ($dbUrl -notmatch [regex]::Escape($ProjectRef)) {
  $dbUrl = $null
  throw 'Refusing connection string: it does not contain the GLAM project ref.'
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$root = Join-Path $repo $OutputRoot
$work = Join-Path $root ("GLAM-T0-" + $stamp)
New-Item -ItemType Directory -Force -Path $work | Out-Null

$roles = Join-Path $work 'roles.sql'
$schema = Join-Path $work 'schema.sql'
$data = Join-Path $work 'data.sql'
$manifest = Join-Path $work 'manifest.json'
$archive = Join-Path $root ("GLAM-T0-" + $stamp + ".zip")
$encrypted = $archive + '.gpg'
$hashFile = $encrypted + '.sha256.txt'

function Invoke-Dump([string[]]$Arguments) {
  $exitCode = Invoke-Supabase (@('db','dump','--db-url',$dbUrl) + $Arguments)
  if ($exitCode -ne 0) {
    throw ('Supabase db dump failed: ' + ($Arguments -join ' '))
  }
}

try {
  Write-Host 'Exporting roles...'
  Invoke-Dump @('-f',$roles,'--role-only')

  Write-Host 'Exporting application schema...'
  Invoke-Dump @('-f',$schema)

  Write-Host 'Exporting application data...'
  Invoke-Dump @(
    '-f',$data,
    '--use-copy',
    '--data-only',
    '-x','storage.buckets_vectors',
    '-x','storage.vector_indexes'
  )

  foreach ($path in @($roles,$schema,$data)) {
    if (-not (Test-Path -LiteralPath $path)) { throw "Missing dump artifact: $path" }
    if ((Get-Item -LiteralPath $path).Length -eq 0) { throw "Empty dump artifact: $path" }
  }

  $files = foreach ($path in @($roles,$schema,$data)) {
    $item = Get-Item -LiteralPath $path
    [ordered]@{
      name = $item.Name
      bytes = $item.Length
      sha256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
    }
  }

  $m = [ordered]@{
    projectRef = $ProjectRef
    createdAt = (Get-Date).ToString('o')
    purpose = 'GLAM G6 pre-migration T0 logical export'
    productionWritePerformed = $false
    scope = 'Supabase CLI filtered roles/schema/data logical export'
    managedSchemas = [ordered]@{
      auth = 'NOT CLAIMED by this artifact; Supabase CLI excludes managed schemas'
      storageDatabaseSchema = 'NOT CLAIMED by this artifact; Supabase CLI excludes managed schemas'
      storageObjects = 'NOT INCLUDED; must be handled separately if required'
    }
    consistencyNote = 'roles/schema/data are separate Supabase CLI dump invocations; do not claim one shared PostgreSQL snapshot unless application writes were frozen for the export window'
    files = $files
  }
  $m | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifest -Encoding UTF8

  if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
  & $tar -a -c -f $archive -C $work 'roles.sql' 'schema.sql' 'data.sql' 'manifest.json'
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $archive)) {
    throw 'Failed to create local T0 archive.'
  }

  Write-Host 'Encrypting archive with GnuPG. Enter the encryption passphrase only in the GPG prompt.'
  & $gpg --symmetric --cipher-algo AES256 --output $encrypted $archive
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $encrypted)) {
    throw 'GnuPG encryption failed. Plaintext artifacts were retained locally for recovery; do not upload them.'
  }

  $encHash = (Get-FileHash -LiteralPath $encrypted -Algorithm SHA256).Hash
  ("{0}  {1}" -f $encHash,(Split-Path $encrypted -Leaf)) |
    Set-Content -LiteralPath $hashFile -Encoding ASCII

  Write-Host 'Verifying encrypted artifact can be parsed by GnuPG...'
  $previousNativePreference = $null
  $nativePreferenceSupported = Test-Path variable:PSNativeCommandUseErrorActionPreference
  if ($nativePreferenceSupported) {
    $previousNativePreference = $PSNativeCommandUseErrorActionPreference
    $PSNativeCommandUseErrorActionPreference = $false
  }
  try {
    & $gpg --batch --list-packets $encrypted 1>$null 2>$null
    $gpgVerifyExit = $LASTEXITCODE
  } finally {
    if ($nativePreferenceSupported) {
      $PSNativeCommandUseErrorActionPreference = $previousNativePreference
    }
  }
  if ($gpgVerifyExit -ne 0) {
    throw 'Encrypted artifact packet verification failed.'
  }

  # Remove plaintext only after encrypted artifact and its checksum exist.
  Remove-Item -LiteralPath $archive -Force
  Remove-Item -LiteralPath $work -Recurse -Force

  Write-Output 'PASS: GLAM application T0 logical export encrypted locally.'
  Write-Output ('Encrypted artifact: ' + $encrypted)
  Write-Output ('SHA-256 file: ' + $hashFile)
  Write-Output 'LIMITATION: managed Auth/Storage schemas and Storage objects are not claimed by this artifact.'
  Write-Output 'NEXT: restore this artifact into a fresh isolated database and verify protected counts/ID sets before production migration.'
} finally {
  $dbUrl = $null
  $secure = $null
}
