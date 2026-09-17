$ErrorActionPreference = 'Stop'
# Exercise the real backup script on synthetic files. Only Windows services and
# ACL application are replaced: these must never touch the installed server.
$root = Join-Path ([IO.Path]::GetTempPath()) ('saraya-repair-test-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $root | Out-Null
try {
    $scripts = Join-Path $PSScriptRoot '..\scripts'
    Copy-Item (Join-Path $scripts 'pre-upgrade-backup.ps1') $root
    $helper = Get-Content (Join-Path $scripts 'protected-storage.ps1') -Raw
    $helper += @'

function Protect-Storage([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { New-Item -ItemType Directory -Path $Path -Force | Out-Null }
}
function Get-Service { return $null }
function Start-Service { throw 'Test must not start a service' }
function Stop-Service { throw 'Test must not stop a service' }
function Invoke-PgTool { throw 'Incomplete installation must not require a logical database dump' }
'@
    Set-Content (Join-Path $root 'protected-storage.ps1') $helper -Encoding UTF8
    $install = Join-Path $root 'installation'
    $data = Join-Path $root 'state'
    foreach ($path in @("$install\node", "$data\config", "$data\data\postgresql\base", "$data\backups")) {
        New-Item -ItemType Directory -Path $path -Force | Out-Null
    }
    Set-Content "$install\node\node.exe" 'synthetic binary'
    Set-Content "$data\config\server.env" 'SYNTHETIC_CONFIG=preserve'
    Set-Content "$data\data\postgresql\PG_VERSION" '16'
    Set-Content "$data\data\postgresql\base\fixture" 'preserve database bytes'
    $snapshot = "$data\backups\repair"
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$root\pre-upgrade-backup.ps1" -InstallDir $install -DataDir $data -BackupDir $snapshot -Repair -ErrorLog "$root\error.txt"
    if ($LASTEXITCODE -ne 0) { throw 'Repair backup failed' }
    $manifest = Get-Content "$snapshot\manifest.json" -Raw | ConvertFrom-Json
    if ($manifest.version -ne 3 -or $manifest.kind -ne 'incomplete-installation') { throw 'Wrong snapshot format' }
    if (@($manifest.data_files).Count -ne 2 -or @($manifest.files).Count -ne 1) { throw 'Incomplete snapshot inventory' }
    foreach ($relative in @('data\postgresql\PG_VERSION','data\postgresql\base\fixture','config\server.env')) {
        if ((Get-FileHash "$snapshot\$relative").Hash -ne (Get-FileHash "$data\$relative").Hash) { throw 'Snapshot differs from source' }
    }
    # Normal upgrades must still attempt the logical backup. The service mock
    # rejects startup so this must fail rather than silently use repair mode.
    $ErrorActionPreference = 'Continue'
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$root\pre-upgrade-backup.ps1" -InstallDir $install -DataDir $data -BackupDir "$data\backups\upgrade" -ErrorLog "$root\error.txt" 2>&1 | Out-Null
    $ErrorActionPreference = 'Stop'
    if ($LASTEXITCODE -eq 0 -or (Test-Path "$data\backups\upgrade\manifest.json")) { throw 'Upgrade bypassed logical backup' }
    # A live cluster must remain blocked, even when the Windows service is absent.
    Set-Content "$data\data\postgresql\postmaster.pid" '12345'
    $ErrorActionPreference = 'Continue'
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$root\pre-upgrade-backup.ps1" -InstallDir $install -DataDir $data -BackupDir "$data\backups\live" -Repair -ErrorLog "$root\error.txt" 2>&1 | Out-Null
    $ErrorActionPreference = 'Stop'
    if ($LASTEXITCODE -eq 0 -or (Test-Path "$data\backups\live\manifest.json")) { throw 'Live cluster was accepted' }
    if ((Get-Content "$root\error.txt" -Raw) -notmatch 'preserve existing database') { throw 'Missing safe error report' }
    Write-Output 'PASS: incomplete setup preserved; hashes verified; upgrade backup still required; live cluster rejected.'
} finally {
    $resolved = [IO.Path]::GetFullPath($root)
    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (-not $resolved.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path -Leaf $resolved) -notlike 'saraya-repair-test-*') { throw 'Unsafe cleanup target' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
