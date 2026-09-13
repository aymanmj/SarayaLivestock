<#
.SYNOPSIS
Runs Prisma database migrations using the guarded lifecycle tool.
تشغيل ترحيلات قاعدة البيانات باستخدام أداة دورة الحياة الآمنة

.DESCRIPTION
Sets up required environment variables and runs the node migration script.
إعداد متغيرات البيئة المطلوبة وتشغيل سكربت ترحيل قاعدة البيانات
#>

[CmdletBinding()]
param (
    [Parameter(Mandatory=$true)]
    [string]$InstallDir,
    
    [Parameter(Mandatory=$true)]
    [string]$DataDir,
    
    [Parameter(Mandatory=$true)]
    [string]$DbName
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

try {
    Write-Output "Starting database migrations / بدء ترحيل قاعدة البيانات"

    $envFilePath = Join-Path $DataDir "config\server.env"
    
    if (-not (Test-Path $envFilePath)) {
        throw "Environment file not found / لم يتم العثور على ملف البيئة: $envFilePath"
    }

    # Helper function to read env values safely
    function Get-EnvValue {
        param([string]$Key, [string]$FilePath)
        $pattern = "^$Key=(.*)$"
        $match = (Get-Content $FilePath) -match $pattern | Select-Object -First 1
        if ($match) {
            $value = $match -replace $pattern, '$1'
            return $value.Trim(" `"'")
        }
        return $null
    }

    $dbUrl = Get-EnvValue -Key "DATABASE_URL" -FilePath $envFilePath
    $jwtSecret = Get-EnvValue -Key "JWT_SECRET" -FilePath $envFilePath

    if (-not $dbUrl) { throw "DATABASE_URL not found in server.env" }

    # Set Environment Variables / تعيين متغيرات البيئة
    $env:DATABASE_URL = $dbUrl
    $env:JWT_SECRET = $jwtSecret
    $env:SARAYA_DB_ENV = "production"
    $env:SARAYA_DB_CONFIRM = $DbName
    $env:SARAYA_DB_ALLOW_PRODUCTION = "true"
    $env:SARAYA_DB_CHANGE_TICKET = "INSTALL-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    $env:SARAYA_DB_WRITES_STOPPED = "true"
    $env:DATABASE_BACKUP_DIR = Join-Path $DataDir "backups"
    $env:PG_DUMP_PATH = Join-Path $InstallDir "postgresql\bin\pg_dump.exe"
    $env:PG_RESTORE_PATH = Join-Path $InstallDir "postgresql\bin\pg_restore.exe"

    $nodeExe = Join-Path $InstallDir "node\node.exe"
    $migrationScript = Join-Path $InstallDir "server\dist\cli\database-lifecycle.js"
    $serverDir = Join-Path $InstallDir "server"

    if (-not (Test-Path -LiteralPath $serverDir -PathType Container)) {
        throw "Server directory not found / لم يتم العثور على مجلد الخادم: $serverDir"
    }

    # Start PostgreSQL service if not running (Assuming Windows service is named postgresql-saraya or similar)
    # Since script context indicates PostgreSQL is managed somehow, we'll try to check and start the service if it exists
    # If it's running via caddy/supervisor or standard postgres, this part might need adjustment
    $pgServiceName = "SarayaPostgreSQL"
    if (Get-Service $pgServiceName -ErrorAction SilentlyContinue) {
        if ((Get-Service $pgServiceName).Status -ne 'Running') {
            Write-Output "Starting PostgreSQL service / بدء تشغيل خدمة PostgreSQL"
            Start-Service $pgServiceName
        }
    }

    $migrationExitCode = 1
    Push-Location -LiteralPath $serverDir
    try {
        Write-Output "Inspecting database migration state / فحص حالة ترحيلات قاعدة البيانات"
        $inspectionOutput = @(& $nodeExe $migrationScript inspect 2>&1)
        $inspectionExitCode = $LASTEXITCODE
        if ($inspectionExitCode -ne 0) {
            $inspectionOutput | ForEach-Object { Write-Output $_ }
            throw "Database inspection exited with code $inspectionExitCode"
        }

        try {
            $inspection = (($inspectionOutput | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine) | ConvertFrom-Json
        }
        catch {
            throw "Could not parse database inspection output: $($_.Exception.Message)"
        }

        $pendingMigrations = @($inspection.pendingMigrations)
        if ($pendingMigrations.Count -eq 0) {
            Write-Output "Database schema is already current; no migrations are pending. / مخطط قاعدة البيانات محدث بالفعل"
            $migrationExitCode = 0
        }
        else {
            $manifestPath = $null
            if ($inspection.state -ne 'EMPTY') {
                $migrationBackupDir = Join-Path $env:DATABASE_BACKUP_DIR ("migration-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
                New-Item -ItemType Directory -Path $migrationBackupDir -Force | Out-Null

                Write-Output "Creating verified pre-migration backup / إنشاء نسخة احتياطية موثقة قبل الترحيل"
                $backupOutput = @(& $nodeExe $migrationScript backup --output-dir $migrationBackupDir 2>&1)
                $backupExitCode = $LASTEXITCODE
                $backupOutput | ForEach-Object { Write-Output $_ }
                if ($backupExitCode -ne 0) {
                    throw "Verified database backup exited with code $backupExitCode"
                }

                $manifestLine = $backupOutput |
                    ForEach-Object { $_.ToString() } |
                    Where-Object { $_ -match '^Backup manifest:\s*' } |
                    Select-Object -Last 1
                if (-not $manifestLine) {
                    throw "Verified backup did not report its manifest path"
                }
                $manifestMatch = [regex]::Match($manifestLine, '^Backup manifest:\s*(.+)$')
                $manifestPath = $manifestMatch.Groups[1].Value.Trim()
                if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
                    throw "Verified backup manifest was not found: $manifestPath"
                }
            }

            Write-Output "Running migration script / تشغيل سكربت الترحيل"
            $migrationArgs = @($migrationScript, 'migrate-safe')
            if ($manifestPath) {
                $migrationArgs += @('--manifest', $manifestPath)
            }
            & $nodeExe @migrationArgs
            $migrationExitCode = $LASTEXITCODE
        }
    }
    finally {
        Pop-Location
    }

    if ($migrationExitCode -ne 0) {
        throw "Migration script exited with code $migrationExitCode / انتهى سكربت الترحيل برمز $migrationExitCode"
    }

    Write-Output "Database migrations completed successfully / تمت ترحيلات قاعدة البيانات بنجاح"
    exit 0
}
catch {
    Write-Error "Failed to run migrations / فشل في تشغيل الترحيلات: $($_.Exception.Message)"
    exit 1
}
