<#
.SYNOPSIS
Performs post-installation health verification.
إجراء فحص صحة النظام بعد التثبيت

.DESCRIPTION
Waits for the API to be ready, checks health endpoints, and verifies migration status.
انتظار جاهزية واجهة برمجة التطبيقات، فحص نقاط النهاية الصحية، والتحقق من حالة الترحيل
#>

[CmdletBinding()]
param (
    [string]$Hostname = 'saraya.local',
    [int]$HttpsPort = 18443,
    [int]$TimeoutSeconds = 60,
    [int]$RetryIntervalSeconds = 5
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

try {
    Write-Output "Starting health check verification / بدء فحص صحة النظام"

    # Verify the API directly so DNS/mDNS and local CA enrollment cannot hide an API failure.
    $readyUrl = "http://127.0.0.1:4000/api/v1/system/health/ready"
    $liveUrl = "http://127.0.0.1:4000/api/v1/system/health/live"
    
    $startTime = Get-Date
    $ready = $false
    $responseData = $null

    # 1. Wait in a loop for the API to respond / الانتظار في حلقة حتى تستجيب واجهة برمجة التطبيقات
    while (($((Get-Date) - $startTime).TotalSeconds) -lt $TimeoutSeconds) {
        try {
            Write-Output "Checking API readiness... / جاري التحقق من جاهزية واجهة برمجة التطبيقات..."
            $response = Invoke-RestMethod -Uri $readyUrl -Method Get -ErrorAction Stop
            $responseData = $response
            $ready = $true
            break
        }
        catch {
            Start-Sleep -Seconds $RetryIntervalSeconds
        }
    }

    if (-not $ready) {
        throw "Timed out waiting for API to become ready / انتهت مهلة انتظار جاهزية واجهة برمجة التطبيقات"
    }

    # 3. Parse JSON response, verify status is 'ready' / تحليل استجابة JSON، والتحقق من أن الحالة جاهزة
    if ($responseData.status -ne 'ready') {
        throw "System status is not ready: $($responseData.status) / حالة النظام غير جاهزة"
    }

    # 4. Verify database readiness and migration level / التحقق من جاهزية قاعدة البيانات ومستوى الترحيل
    # Support both the current compact response and the previous component-based response.
    $componentsProperty = $responseData.PSObject.Properties['components']
    if ($componentsProperty -and $componentsProperty.Value -and
        $componentsProperty.Value.PSObject.Properties['database']) {
        $dbHealth = $componentsProperty.Value.database
        $databaseStatus = $dbHealth.status
        $migrationLevel = $dbHealth.details.migrationLevel
    }
    else {
        $databaseProperty = $responseData.PSObject.Properties['database']
        $migrationProperty = $responseData.PSObject.Properties['requiredMigration']
        if (-not $databaseProperty -or -not $migrationProperty) {
            throw "Health response is missing database readiness fields / استجابة الصحة لا تحتوي حقول جاهزية قاعدة البيانات"
        }
        $databaseStatus = if ($databaseProperty.Value -eq 'connected') { 'healthy' } else { $databaseProperty.Value }
        $migrationLevel = $migrationProperty.Value
    }

    if ($databaseStatus -ne 'healthy') {
        throw "Database is not healthy / قاعدة البيانات ليست بحالة صحية"
    }

    if (-not ($migrationLevel -match '0005_operational_idempotency')) {
        throw "Database migration level is incorrect. Found: $migrationLevel / مستوى ترحيل قاعدة البيانات غير صحيح"
    }

    # 5. Call health/live and verify 200 / التحقق من نقطة النهاية الحية
    Write-Output "Checking system liveness / التحقق من حيوية النظام"
    try {
        $liveResponse = Invoke-WebRequest -Uri $liveUrl -Method Get -UseBasicParsing -ErrorAction Stop
        if ($liveResponse.StatusCode -ne 200) {
            throw "Liveness check failed with status code: $($liveResponse.StatusCode)"
        }
    }
    catch {
        throw "Liveness check request failed / فشل طلب التحقق من حيوية النظام"
    }

    # Verify that Caddy is listening locally on HTTPS as well.
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    try {
        $connect = $tcpClient.BeginConnect('127.0.0.1', $HttpsPort, $null, $null)
        if (-not $connect.AsyncWaitHandle.WaitOne(5000)) {
            throw "Timed out connecting to Caddy HTTPS"
        }
        $tcpClient.EndConnect($connect)
    }
    finally {
        $tcpClient.Dispose()
    }

    # 6. Print result summary (in Arabic) / طباعة ملخص النتائج بالعربية
    Write-Output "========================================="
    Write-Output "نجح فحص النظام بالكامل (Health Check Passed)"
    Write-Output "واجهة برمجة التطبيقات جاهزة (API Ready)"
    Write-Output "قاعدة البيانات متصلة ومحدثة (DB Connected & Migrated)"
    Write-Output "========================================="

    exit 0
}
catch {
    Write-Error "Health check failed / فشل فحص صحة النظام: $($_.Exception.Message)"
    exit 1
}
