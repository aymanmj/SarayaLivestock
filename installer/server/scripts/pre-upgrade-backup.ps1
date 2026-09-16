[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$InstallDir,
    [Parameter(Mandatory=$true)][string]$DataDir,
    [Parameter(Mandatory=$true)][string]$BackupDir
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'protected-storage.ps1')
try {
    $installRoot = Assert-OrdinaryPath $InstallDir
    $backupRoot = Assert-OrdinaryPath (Join-Path $DataDir 'backups')
    $snapshotRoot = Assert-OrdinaryPath $BackupDir
    if (-not $snapshotRoot.StartsWith($backupRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Backup must be inside protected backups' }
    if (Test-Path -LiteralPath $snapshotRoot) { throw 'Backup destination already exists' }
    Protect-Storage $backupRoot
    New-Item -ItemType Directory -Path $snapshotRoot | Out-Null
    Protect-Storage $snapshotRoot
    foreach ($name in @('SarayaCaddy', 'SarayaAPI')) {
        if (Get-Service -Name $name -ErrorAction SilentlyContinue) { Stop-Service -Name $name -Force -ErrorAction Stop }
    }
    Start-Service -Name 'SarayaPostgreSQL'
    Set-PostgresEnvironment (Join-Path $DataDir 'config\server.env')
    $dump = Join-Path $snapshotRoot 'database.backup'
    Invoke-PgTool (Join-Path $installRoot 'postgresql\bin\pg_dump.exe') @('--no-password', '--format=custom', '--file', $dump)
    Invoke-PgTool (Join-Path $installRoot 'postgresql\bin\pg_restore.exe') @('--list', $dump)
    if ((Get-Item -LiteralPath $dump).Length -eq 0) { throw 'Empty database backup' }
    Stop-Service -Name 'SarayaPostgreSQL' -Force -ErrorAction Stop
    $snapshotInstall = Join-Path $snapshotRoot 'installation'
    New-Item -ItemType Directory -Path $snapshotInstall | Out-Null
    $roots = @('node', 'postgresql', 'caddy', 'services', 'server', 'web')
    $hashes = @()
    foreach ($name in $roots) {
        $source = Assert-OrdinaryPath (Join-Path $installRoot $name)
        if (-not (Test-Path -LiteralPath $source -PathType Container)) { throw "Missing installation directory: $name" }
        $items = @(Get-ChildItem -LiteralPath $source -Recurse -Force)
        if ($items | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) { throw 'Installation contains reparse points' }
        Copy-Item -LiteralPath $source -Destination $snapshotInstall -Recurse -Force
        foreach ($file in $items | Where-Object { -not $_.PSIsContainer }) {
            $relative = $file.FullName.Substring($installRoot.Length).TrimStart('\')
            $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
            if ((Get-FileHash -LiteralPath (Join-Path $snapshotInstall $relative) -Algorithm SHA256).Hash -ne $hash) { throw 'Binary backup verification failed' }
            $hashes += @{ path = $relative; sha256 = $hash }
        }
    }
    $configSource = Assert-OrdinaryPath (Join-Path $DataDir 'config')
    if (Get-ChildItem -LiteralPath $configSource -Recurse -Force | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) { throw 'Configuration contains reparse points' }
    Copy-Item -LiteralPath $configSource -Destination (Join-Path $snapshotRoot 'config') -Recurse -Force
    $configHashes = @(Get-ChildItem -LiteralPath (Join-Path $snapshotRoot 'config') -Recurse -File -Force | ForEach-Object {
        @{ path = $_.FullName.Substring((Join-Path $snapshotRoot 'config').Length).TrimStart('\'); sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash }
    })
    $manifest = @{
        version = 2; timestamp = [DateTime]::UtcNow.ToString('o'); install_dir = $installRoot
        database_name = $env:PGDATABASE; backup_file_hash = (Get-FileHash -LiteralPath $dump -Algorithm SHA256).Hash
        roots = $roots; files = $hashes; config_files = $configHashes
    }
    $manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $snapshotRoot 'manifest.json') -Encoding UTF8
    Protect-Storage $snapshotRoot
    Write-Output "Verified database, configuration and executable backup: $snapshotRoot"
    exit 0
} catch {
    Write-Error "Pre-upgrade backup failed; program files have not been replaced. $($_.Exception.Message)" -ErrorAction Continue
    exit 1
} finally {
    foreach ($key in @('PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','PGCONNECT_TIMEOUT')) { Remove-Item -LiteralPath "Env:\$key" -ErrorAction SilentlyContinue }
}
