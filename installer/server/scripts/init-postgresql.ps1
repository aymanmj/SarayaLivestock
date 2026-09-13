<#
.SYNOPSIS
Initializes PostgreSQL database cluster and creates the application database.
تهيئة قاعدة بيانات PostgreSQL وإنشاء قاعدة بيانات التطبيق

.DESCRIPTION
Sets up the PGDATA directory, initializes the cluster, configures auth, and creates users/db.
إعداد مسار البيانات، تهيئة النظام، تكوين المصادقة، وإنشاء المستخدمين وقاعدة البيانات
#>

[CmdletBinding()]
param (
    [Parameter(Mandatory=$true)]
    [string]$InstallDir,
    
    [Parameter(Mandatory=$true)]
    [string]$DataDir,

    [string]$TmpDir = '',
    
    [string]$DbName = 'saraya_livestock_prod',
    [string]$DbUser = 'saraya',
    
    [Parameter(Mandatory=$true)]
    [string]$DbPassword
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

try {
    Write-Output "Starting PostgreSQL initialization / بدء تهيئة PostgreSQL"

    $pgBinDir = Join-Path $InstallDir "postgresql\bin"
    $pgData = Join-Path $DataDir "data\postgresql"
    $pgLogDir = Join-Path $DataDir "logs\postgresql"
    $pgLogDirForwardSlashes = $pgLogDir -replace '\\', '/'

    $env:PGDATA = $pgData

    # Ensure log directory exists
    if (-not (Test-Path $pgLogDir)) {
        New-Item -ItemType Directory -Path $pgLogDir | Out-Null
    }

    # 0. Check for existing cluster / التحقق من وجود قاعدة بيانات مسبقاً
    $versionFile = Join-Path $pgData "PG_VERSION"
    if (Test-Path $versionFile) {
        Write-Output "PostgreSQL data directory already exists. Skipping initdb. / قاعدة البيانات موجودة مسبقاً."
        exit 0
    }
    
    if (Test-Path $pgData) {
        Write-Output "Cleaning incomplete data directory / تنظيف المجلد غير المكتمل"
        Remove-Item -Path "$pgData\*" -Recurse -Force -ErrorAction SilentlyContinue
    } else {
        New-Item -ItemType Directory -Path $pgData | Out-Null
    }

    # 1. Initialize DB / تهيئة قاعدة البيانات
    Write-Output "Running initdb / تشغيل initdb"
    
    $pwFile = Join-Path $TmpDir "pg_pw.tmp"
    Set-Content -Path $pwFile -Value $DbPassword -Encoding UTF8
    
    $initdbPath = Join-Path $pgBinDir "initdb.exe"
    & $initdbPath -D $pgData -U postgres -E UTF8 --no-locale --auth-host=scram-sha-256 --auth-local=scram-sha-256 "--pwfile=$pwFile" | Out-Null
    $exitCode = $LASTEXITCODE
    
    Remove-Item -Path $pwFile -Force -ErrorAction SilentlyContinue
    
    if ($exitCode -ne 0) { throw "initdb failed / فشل initdb" }

    # 2. Copy configurations / نسخ الإعدادات
    $templateDir = if ($TmpDir) { $TmpDir } else { Join-Path $InstallDir "postgresql\templates" }
    if (Test-Path (Join-Path $templateDir "pg_hba.conf.template")) {
        Copy-Item -Path (Join-Path $templateDir "pg_hba.conf.template") -Destination (Join-Path $pgData "pg_hba.conf") -Force
    }

    $pgConfTemplate = Join-Path $templateDir "postgresql.conf.template"
    if (Test-Path $pgConfTemplate) {
        $confContent = Get-Content -Path $pgConfTemplate -Raw -Encoding UTF8
        $confContent = $confContent -replace '\{\{LOG_DIR\}\}', $pgLogDirForwardSlashes
        Set-Content -Path (Join-Path $pgData "postgresql.conf") -Value $confContent -Encoding UTF8 -Force
    }

    # 3. Start PostgreSQL temporarily / تشغيل مؤقت لقاعدة البيانات
    Write-Output "Starting PostgreSQL temporarily / تشغيل PostgreSQL بشكل مؤقت"
    $pgCtlPath = Join-Path $pgBinDir "pg_ctl.exe"
    & $pgCtlPath start -D $pgData -w -t 30 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "pg_ctl start failed / فشل تشغيل pg_ctl" }

    try {
        # 4. Set superuser password / تعيين كلمة مرور المسؤول
        $psqlPath = Join-Path $pgBinDir "psql.exe"
        $postgresPwScript = "ALTER USER postgres WITH PASSWORD '$DbPassword';"
        $postgresPwScript | & $psqlPath -U postgres -d postgres | Out-Null

        # 5. Create application user / إنشاء مستخدم التطبيق
        Write-Output "Creating application user / إنشاء مستخدم التطبيق"
        $createuserPath = Join-Path $pgBinDir "createuser.exe"
        & $createuserPath --no-superuser --no-createdb --no-createrole $DbUser -U postgres | Out-Null
        
        # 6. Set application user password / تعيين كلمة مرور مستخدم التطبيق
        $appUserPwScript = "ALTER USER $DbUser WITH PASSWORD '$DbPassword';"
        $appUserPwScript | & $psqlPath -U postgres -d postgres | Out-Null

        # 7. Create database / إنشاء قاعدة البيانات
        Write-Output "Creating database / إنشاء قاعدة البيانات"
        $createdbPath = Join-Path $pgBinDir "createdb.exe"
        & $createdbPath --owner=$DbUser $DbName -U postgres | Out-Null

        # 8. Verify connectivity / التحقق من الاتصال
        Write-Output "Verifying connectivity / التحقق من الاتصال"
        $pgIsreadyPath = Join-Path $pgBinDir "pg_isready.exe"
        & $pgIsreadyPath -d $DbName -U $DbUser | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Database connectivity check failed / فشل التحقق من الاتصال بقاعدة البيانات" }

    }
    finally {
        # 9. Stop PostgreSQL / إيقاف PostgreSQL
        Write-Output "Stopping PostgreSQL / إيقاف PostgreSQL"
        & $pgCtlPath stop -D $pgData -m fast -w | Out-Null
    }

    Write-Output "PostgreSQL initialized successfully / تم تهيئة PostgreSQL بنجاح"
    exit 0
}
catch {
    Write-Error "Failed to initialize PostgreSQL / فشل في تهيئة PostgreSQL: $($_.Exception.Message)"
    exit 1
}
