[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$InstallDir,
    [Parameter(Mandatory=$true)][string]$DataDir,
    [Parameter(Mandatory=$true)][string]$BackupDir
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'protected-storage.ps1')
function Assert-SnapshotFiles([string]$Root, $Files) {
    $rootPath = Assert-OrdinaryPath $Root
    foreach ($file in $Files) {
        $path = Assert-OrdinaryPath (Join-Path $rootPath $file.path)
        if (-not $path.StartsWith($rootPath.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid snapshot path' }
        if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $file.sha256) { throw 'Snapshot checksum mismatch' }
    }
    $actual = @(Get-ChildItem -LiteralPath $rootPath -Recurse -Force)
    if ($actual | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) { throw 'Snapshot contains reparse points' }
    if (@($actual | Where-Object { -not $_.PSIsContainer }).Count -ne @($Files).Count) { throw 'Unexpected snapshot files' }
}
try {
    $installRoot = Assert-OrdinaryPath $InstallDir
    $dataRoot = Assert-OrdinaryPath $DataDir
    $snapshotRoot = Assert-OrdinaryPath $BackupDir
    $manifest = Get-Content -LiteralPath (Join-Path $snapshotRoot 'manifest.json') -Raw | ConvertFrom-Json
    if ($manifest.version -ne 2 -or $manifest.install_dir -ne $installRoot) { throw 'A complete version 2 backup of this installation is required' }
    $roots = @('node', 'postgresql', 'caddy', 'services', 'server', 'web')
    if (($manifest.roots -join ',') -ne ($roots -join ',')) { throw 'Invalid executable inventory' }
    $snapshotInstall = Join-Path $snapshotRoot 'installation'
    $snapshotConfig = Join-Path $snapshotRoot 'config'
    Assert-SnapshotFiles $snapshotInstall $manifest.files
    Assert-SnapshotFiles $snapshotConfig $manifest.config_files
    $dump = Join-Path $snapshotRoot 'database.backup'
    if ((Get-FileHash -LiteralPath $dump -Algorithm SHA256).Hash -ne $manifest.backup_file_hash) { throw 'Database backup checksum mismatch' }
    Set-PostgresEnvironment (Join-Path $snapshotConfig 'server.env')
    if ($env:PGDATABASE -ne $manifest.database_name) { throw 'Database identity mismatch' }
    foreach ($name in @('SarayaCaddy','SarayaAPI','SarayaPostgreSQL')) {
        if (Get-Service -Name $name -ErrorAction SilentlyContinue) { Stop-Service -Name $name -Force -ErrorAction Stop }
    }
    # Keep the failed version for investigation; never merge old and new binaries.
    $failedRoot = Join-Path $snapshotRoot ('failed-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $failedRoot | Out-Null
    foreach ($name in $roots) {
        $target = Assert-OrdinaryPath (Join-Path $installRoot $name)
        if (-not $target.StartsWith($installRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe restore target' }
        if (Test-Path -LiteralPath $target) {
            if (Get-ChildItem -LiteralPath $target -Recurse -Force | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) { throw 'Reparse point in restore target' }
            Move-Item -LiteralPath $target -Destination (Join-Path $failedRoot $name)
        }
        Copy-Item -LiteralPath (Join-Path $snapshotInstall $name) -Destination $installRoot -Recurse -Force
    }
    $configTarget = Assert-OrdinaryPath (Join-Path $dataRoot 'config')
    if (Test-Path -LiteralPath $configTarget) {
        if (Get-ChildItem -LiteralPath $configTarget -Recurse -Force | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) { throw 'Reparse point in config restore target' }
        Move-Item -LiteralPath $configTarget -Destination (Join-Path $failedRoot 'config')
    }
    Copy-Item -LiteralPath $snapshotConfig -Destination $configTarget -Recurse -Force
    Protect-Storage $configTarget -ServiceRead
    foreach ($name in $roots) {
        $files = @($manifest.files | Where-Object { $_.path.StartsWith($name + '\') } | ForEach-Object {
            @{ path = $_.path.Substring($name.Length + 1); sha256 = $_.sha256 }
        })
        Assert-SnapshotFiles (Join-Path $installRoot $name) $files
    }
    Start-Service -Name 'SarayaPostgreSQL'
    $ready = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        try { Invoke-PgTool (Join-Path $installRoot 'postgresql\bin\pg_isready.exe') @('--quiet'); $ready = $true; break } catch { Start-Sleep -Seconds 1 }
    }
    if (-not $ready) { throw 'PostgreSQL did not become ready' }
    $sqlFile = Join-Path $failedRoot 'restore.sql'
    Invoke-PgTool (Join-Path $installRoot 'postgresql\bin\pg_restore.exe') @('--no-owner', '--no-privileges', '--file', $sqlFile, $dump)
    # Rebuild the application schema in ONE transaction without CREATEDB rights.
    # This removes objects introduced by the failed migration as well.
    $driver = Join-Path $failedRoot 'restore-transaction.sql'
    $sqlPath = $sqlFile.Replace('\', '/').Replace("'", "''")
    $commands = @('DROP SCHEMA IF EXISTS public CASCADE;')
    if (-not (Select-String -LiteralPath $sqlFile -Pattern '^CREATE SCHEMA public;' -Quiet)) { $commands += 'CREATE SCHEMA public;' }
    $commands += "\i '$sqlPath'"
    $commands | Set-Content -LiteralPath $driver -Encoding UTF8
    Invoke-PgTool (Join-Path $installRoot 'postgresql\bin\psql.exe') @('--no-password', '--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--single-transaction', '--file', $driver)
    Start-Service -Name 'SarayaAPI'
    $apiReady = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            $response = Invoke-RestMethod -Uri 'http://127.0.0.1:4000/api/v1/system/health/ready' -TimeoutSec 2
            if ($response.status -eq 'ready') { $apiReady = $true; break }
        } catch { }
        Start-Sleep -Seconds 2
    }
    if (-not $apiReady) { throw 'Restored API failed readiness; web access remains stopped' }
    Start-Service -Name 'SarayaCaddy'
    Write-Output 'Previous executables, configuration and database restored; API readiness verified.'
    exit 0
} catch {
    Write-Error "Rollback failed; keep the farm offline and retain the verified backup. $($_.Exception.Message)" -ErrorAction Continue
    exit 1
} finally {
    foreach ($key in @('PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','PGCONNECT_TIMEOUT')) { Remove-Item -LiteralPath "Env:\$key" -ErrorAction SilentlyContinue }
}
