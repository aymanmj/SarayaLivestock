<#
.SYNOPSIS
    Pre-upgrade Backup Script / نص النسخ الاحتياطي قبل الترقية
.DESCRIPTION
    Creates a verified backup before upgrading the Saraya Livestock server.
    يقوم بإنشاء نسخة احتياطية تم التحقق منها قبل ترقية خادم سرايا للثروة الحيوانية.
#>
[CmdletBinding()]
param (
    [Parameter(Mandatory=$true)]
    [string]$InstallDir,

    [Parameter(Mandatory=$true)]
    [string]$DataDir
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

try {
    Write-Host "Starting pre-upgrade backup... / بدء النسخ الاحتياطي قبل الترقية..."
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backupDir = Join-Path $DataDir "backups\upgrade-$timestamp"
    
    # 1. Create backup directory / إنشاء مجلد النسخ الاحتياطي
    if (-not (Test-Path $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir | Out-Null
    }

    # 2. Stop SarayaCaddy and SarayaAPI services / إيقاف خدمات واجهة برمجة التطبيقات والويب
    Write-Host "Stopping Caddy and API services... / إيقاف خدمات Caddy و API..."
    $servicesToStop = @("SarayaCaddy", "SarayaAPI")
    foreach ($service in $servicesToStop) {
        if (Get-Service -Name $service -ErrorAction SilentlyContinue) {
            Stop-Service -Name $service -Force
            Write-Host "Service $service stopped. / تم إيقاف الخدمة."
        }
    }

    # 3. Read DATABASE_URL and run pg_dump / قراءة رابط قاعدة البيانات وتشغيل النسخ الاحتياطي
    $envFile = Join-Path $DataDir "config\server.env"
    if (-not (Test-Path $envFile)) {
        throw "Environment file not found at $envFile / ملف البيئة غير موجود"
    }

    $envContent = Get-Content $envFile
    $dbUrlMatch = $envContent | Select-String -Pattern "^DATABASE_URL=(.+)$"
    if (-not $dbUrlMatch) {
        throw "DATABASE_URL not found in server.env / لم يتم العثور على رابط قاعدة البيانات"
    }
    
    $dbUrl = $dbUrlMatch.Matches[0].Groups[1].Value.Trim()
    if (($dbUrl.Length -ge 2) -and
        (($dbUrl.StartsWith('"') -and $dbUrl.EndsWith('"')) -or
         ($dbUrl.StartsWith("'") -and $dbUrl.EndsWith("'")))) {
        $dbUrl = $dbUrl.Substring(1, $dbUrl.Length - 2)
    }

    # Parse the connection URL explicitly. PostgreSQL command-line tools do not
    # read DATABASE_URL automatically, and running pg_dump without -d can wait
    # for interactive credentials in a hidden installer window.
    $dbUri = [Uri]$dbUrl
    if ($dbUri.Scheme -notin @('postgresql', 'postgres')) {
        throw "Unsupported DATABASE_URL scheme: $($dbUri.Scheme)"
    }

    $userInfo = $dbUri.UserInfo.Split(':', 2)
    if ($userInfo.Count -ne 2) {
        throw "DATABASE_URL does not contain database credentials"
    }

    $dbUser = [Uri]::UnescapeDataString($userInfo[0])
    $dbPassword = [Uri]::UnescapeDataString($userInfo[1])
    $dbName = [Uri]::UnescapeDataString($dbUri.AbsolutePath.TrimStart('/'))
    $dbPort = if ($dbUri.IsDefaultPort) { 5432 } else { $dbUri.Port }

    if ([string]::IsNullOrWhiteSpace($dbName)) {
        throw "DATABASE_URL does not contain a database name"
    }

    $pgDumpPath = Join-Path $InstallDir "postgresql\bin\pg_dump.exe"
    if (-not (Test-Path $pgDumpPath)) {
        throw "pg_dump.exe not found at $pgDumpPath / أداة النسخ الاحتياطي غير موجودة"
    }

    $backupFile = Join-Path $backupDir "database.backup"
    Write-Host "Running pg_dump... / جاري أخذ نسخة احتياطية من قاعدة البيانات..."
    
    $env:PGPASSWORD = $dbPassword
    $pgDumpArgs = @(
        '-h', $dbUri.Host,
        '-p', [string]$dbPort,
        '-U', $dbUser,
        '-d', $dbName,
        '-Fc',
        '-f', $backupFile
    )

    & $pgDumpPath @pgDumpArgs
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump failed with exit code $LASTEXITCODE / فشل النسخ الاحتياطي"
    }

    # 4. Copy server.env / نسخ ملف البيئة
    Copy-Item -Path $envFile -Destination $backupDir -Force
    Write-Host "server.env backed up. / تم نسخ ملف البيئة."

    # 5. Create manifest.json / إنشاء ملف الوصف
    $fileHash = (Get-FileHash -Path $backupFile -Algorithm SHA256).Hash
    
    $manifest = @{
        version = "1.0"
        timestamp = $timestamp
        database_name = $dbName
        backup_file_hash = $fileHash
    } | ConvertTo-Json

    $manifestPath = Join-Path $backupDir "manifest.json"
    Set-Content -Path $manifestPath -Value $manifest -Encoding UTF8
    Write-Host "Manifest created at $manifestPath / تم إنشاء ملف الوصف"

    # 6. Verify backup file / التحقق من ملف النسخة الاحتياطية
    $fileInfo = Get-Item $backupFile
    if ($fileInfo.Length -eq 0) {
        throw "Backup file is empty / ملف النسخة الاحتياطية فارغ"
    }

    $pgRestorePath = Join-Path $InstallDir "postgresql\bin\pg_restore.exe"
    & $pgRestorePath '--list' $backupFile | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Backup verification failed with exit code $LASTEXITCODE / فشل التحقق من النسخة الاحتياطية"
    }

    # 7. Print backup summary / عرض ملخص النسخ الاحتياطي
    Write-Host "Backup completed successfully! / اكتمل النسخ الاحتياطي بنجاح!"
    Write-Host "Backup Directory: $backupDir"
    Write-Host "Database Hash: $fileHash"
    exit 0
}
catch {
    Write-Error "Backup failed / فشل النسخ الاحتياطي: $_"
    exit 1
}
finally {
    # Remove the temporary password from the process environment.
    if (Test-Path env:\PGPASSWORD) {
        Remove-Item Env:\PGPASSWORD
    }
}
