[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$InstallDir,
    [Parameter(Mandatory=$true)][string]$DataDir,
    [Parameter(Mandatory=$true)][string]$BackupDir,
    [switch]$Repair,
    [string]$ErrorLog
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'protected-storage.ps1')
$stage = 'validate backup paths'
try {
    if ($ErrorLog) { Set-Content -LiteralPath $ErrorLog -Value '' -Encoding UTF8 }
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
    $stage = 'preserve existing database'
    if (-not $Repair) {
        try {
            Start-Service -Name 'SarayaPostgreSQL' -ErrorAction Stop
            Set-PostgresEnvironment (Join-Path $DataDir 'config\server.env')
            $dump = Join-Path $snapshotRoot 'database.backup'
            Invoke-PgTool (Join-Path $installRoot 'postgresql\bin\pg_dump.exe') @('--no-password', '--format=custom', '--file', $dump)
            Invoke-PgTool (Join-Path $installRoot 'postgresql\bin\pg_restore.exe') @('--list', $dump)
            if ((Get-Item -LiteralPath $dump).Length -eq 0) { throw 'Empty database backup' }
            Stop-Service -Name 'SarayaPostgreSQL' -Force -ErrorAction Stop
        } catch {
            if ($ErrorLog) { Add-Content -LiteralPath $ErrorLog -Encoding UTF8 -Value "Logical backup failed: $($_.Exception.Message). Falling back to physical repair mode." }
            $Repair = $true
        }
    }

    if ($Repair) {
        # A failed setup may have a cluster but no application role/database yet.
        # Preserve the entire stopped cluster before resuming initialization.
        if (Get-Service -Name 'SarayaPostgreSQL' -ErrorAction SilentlyContinue) {
            Stop-Service -Name 'SarayaPostgreSQL' -Force -ErrorAction SilentlyContinue
        }
        $dataSource = Assert-OrdinaryPath (Join-Path $DataDir 'data')
        $pgData = Join-Path $dataSource 'postgresql'
        if (Test-Path -LiteralPath (Join-Path $pgData 'postmaster.pid')) {
            throw 'PostgreSQL still has a PID file; offline backup is unsafe'
        }
        if (Test-Path -LiteralPath $dataSource) {
            $savedData = Join-Path $snapshotRoot 'data'
            $dataHashes = @(Copy-VerifiedDirectory $dataSource $savedData $dataSource 'data')
        } else { $dataHashes = @() }
    }
    $stage = 'verify existing program files'
    $snapshotInstall = Join-Path $snapshotRoot 'installation'
    New-Item -ItemType Directory -Path $snapshotInstall | Out-Null
    $roots = @('node', 'postgresql', 'caddy', 'services', 'server', 'web')
    $hashes = New-Object 'System.Collections.Generic.List[object]'
    foreach ($name in $roots) {
        $source = Assert-OrdinaryPath (Join-Path $installRoot $name)
        if (-not (Test-Path -LiteralPath $source -PathType Container)) {
            if ($Repair) { continue }
            throw "Missing installation directory: $name"
        }
        foreach ($entry in @(Copy-VerifiedDirectory $source (Join-Path $snapshotInstall $name) $installRoot 'files')) {
            $hashes.Add($entry)
        }
    }
    $stage = 'verify existing configuration'
    $configSource = Assert-OrdinaryPath (Join-Path $DataDir 'config')
    $configHashes = @(Copy-VerifiedDirectory $configSource (Join-Path $snapshotRoot 'config') $configSource 'config')
    if ($Repair) {
        # Deliberately distinct from logical upgrade snapshots: rollback.ps1 must
        # not mistake an incomplete installation for a working version 2 backup.
        $manifest = @{
            version = 3; kind = 'incomplete-installation'; timestamp = [DateTime]::UtcNow.ToString('o')
            install_dir = $installRoot; files = $hashes; config_files = $configHashes; data_files = $dataHashes
        }
    } else {
    $manifest = @{
        version = 2; timestamp = [DateTime]::UtcNow.ToString('o'); install_dir = $installRoot
        database_name = $env:PGDATABASE; backup_file_hash = (Get-FileHash -LiteralPath $dump -Algorithm SHA256).Hash
        roots = $roots; files = $hashes; config_files = $configHashes
    }
    }
    $manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $snapshotRoot 'manifest.json') -Encoding UTF8
    Protect-Storage $snapshotRoot
    Write-Output "Verified database, configuration and executable backup: $snapshotRoot"
    exit 0
} catch {
    if ($ErrorLog) {
        # Do not expose connection strings, passwords, or native tool output.
        Set-Content -LiteralPath $ErrorLog -Encoding UTF8 -Value "Backup failed at stage: $stage. Error type: $($_.Exception.GetType().Name)"
    }
    Write-Error "Pre-upgrade backup failed; program files have not been replaced. $($_.Exception.Message)" -ErrorAction Continue
    exit 1
} finally {
    foreach ($key in @('PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','PGCONNECT_TIMEOUT')) { Remove-Item -LiteralPath "Env:\$key" -ErrorAction SilentlyContinue }
}
