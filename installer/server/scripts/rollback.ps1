<#
.SYNOPSIS
    Rollback Script / نص التراجع
.DESCRIPTION
    Rolls back a failed upgrade by restoring the previous version.
    يتراجع عن ترقية فاشلة من خلال استعادة الإصدار السابق.
#>
[CmdletBinding()]
param (
    [Parameter(Mandatory=$true)]
    [string]$InstallDir,

    [Parameter(Mandatory=$true)]
    [string]$DataDir,

    [Parameter(Mandatory=$true)]
    [string]$BackupDir
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

try {
    Write-Host "Starting rollback process... / بدء عملية التراجع..."

    # 1. Verify BackupDir and manifest / التحقق من مجلد النسخة الاحتياطية
    if (-not (Test-Path $BackupDir)) {
        throw "Backup directory not found: $BackupDir / مجلد النسخة الاحتياطية غير موجود"
    }

    $manifestPath = Join-Path $BackupDir "manifest.json"
    if (-not (Test-Path $manifestPath)) {
        throw "manifest.json not found in backup directory / ملف الوصف غير موجود"
    }

    $manifest = Get-Content $manifestPath | ConvertFrom-Json
    $backupFile = Join-Path $BackupDir "database.backup"
    if (-not (Test-Path $backupFile)) {
        throw "Database backup file not found / ملف قاعدة البيانات الاحتياطي غير موجود"
    }

    # Verify Hash
    $currentHash = (Get-FileHash -Path $backupFile -Algorithm SHA256).Hash
    if ($currentHash -ne $manifest.backup_file_hash) {
        throw "Backup file hash mismatch! / عدم تطابق بصمة ملف النسخة الاحتياطية!"
    }

    # 2. Stop all services / إيقاف جميع الخدمات
    Write-Host "Stopping all services... / إيقاف جميع الخدمات..."
    $servicesToStop = @("SarayaCaddy", "SarayaAPI", "SarayaPostgreSQL")
    foreach ($service in $servicesToStop) {
        if (Get-Service -Name $service -ErrorAction SilentlyContinue) {
            Stop-Service -Name $service -Force
            Write-Host "Service $service stopped. / تم إيقاف الخدمة."
        }
    }

    # 3. Restore server.env / استعادة ملف البيئة
    $envBackupFile = Join-Path $BackupDir "server.env"
    $envTargetFile = Join-Path $DataDir "config\server.env"
    
    if (-not (Test-Path $envBackupFile)) {
        throw "server.env backup not found / لم يتم العثور على نسخة احتياطية من ملف البيئة"
    }
    
    Copy-Item -Path $envBackupFile -Destination $envTargetFile -Force
    Write-Host "server.env restored. / تم استعادة ملف البيئة."

    # Parse DB URL for restoration
    $envContent = Get-Content $envTargetFile
    $dbUrlMatch = $envContent | Select-String -Pattern "^DATABASE_URL=(.+)$"
    $dbUrl = $dbUrlMatch.Matches[0].Groups[1].Value.Trim()
    $dbName = $manifest.database_name
    
    # 4. Restore PostgreSQL / استعادة قاعدة البيانات
    Write-Host "Temporarily starting PostgreSQL for restoration... / بدء تشغيل قاعدة البيانات مؤقتاً للاستعادة..."
    Start-Service -Name "SarayaPostgreSQL"
    Start-Sleep -Seconds 3 # Wait for startup

    $psqlPath = Join-Path $InstallDir "postgresql\bin\psql.exe"
    $pgRestorePath = Join-Path $InstallDir "postgresql\bin\pg_restore.exe"

    # Drop and recreate DB
    Write-Host "Dropping and recreating database $dbName ... / حذف وإعادة إنشاء قاعدة البيانات..."
    $env:DATABASE_URL = $dbUrl
    $dropCmd = "DROP DATABASE IF EXISTS `"$dbName`";"
    $createCmd = "CREATE DATABASE `"$dbName`";"
    
    # Connect to 'postgres' db to drop target db
    $postgresDbUrl = $dbUrl -replace "$dbName(?:\?.*)?$", "postgres"
    $env:DATABASE_URL = $postgresDbUrl
    
    & $psqlPath -c $dropCmd
    & $psqlPath -c $createCmd

    Write-Host "Restoring data... / جاري استعادة البيانات..."
    $env:DATABASE_URL = $dbUrl
    $restoreArgs = @("-d", $dbUrl, "-1", $backupFile)
    $process = Start-Process -FilePath $pgRestorePath -ArgumentList $restoreArgs -NoNewWindow -Wait -PassThru
    
    if ($process.ExitCode -ne 0) {
        Write-Warning "pg_restore finished with exit code $($process.ExitCode). Check for errors. / انتهت عملية الاستعادة مع بعض الأخطاء المحتملة."
    }

    Write-Host "Stopping PostgreSQL... / إيقاف قاعدة البيانات..."
    Stop-Service -Name "SarayaPostgreSQL" -Force

    # 5. Restart all services / إعادة تشغيل جميع الخدمات
    Write-Host "Restarting services in dependency order... / إعادة تشغيل الخدمات بالترتيب الصحيح..."
    $servicesToStart = @("SarayaPostgreSQL", "SarayaAPI", "SarayaCaddy")
    foreach ($service in $servicesToStart) {
        if (Get-Service -Name $service -ErrorAction SilentlyContinue) {
            Start-Service -Name $service
            Write-Host "Service $service started. / تم تشغيل الخدمة."
        }
    }

    Write-Host "Rollback completed successfully! / تمت عملية التراجع بنجاح!"
    exit 0
}
catch {
    Write-Error "Rollback failed / فشلت عملية التراجع: $_"
    exit 1
}
finally {
    if (Test-Path env:\DATABASE_URL) {
        Remove-Item Env:\DATABASE_URL
    }
}
