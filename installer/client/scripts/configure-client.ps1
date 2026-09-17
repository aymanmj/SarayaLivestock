# =============================================================================
# Saraya Livestock — Client Configuration Utility
# أداة تهيئة اتصال محطة العميل بخادم منظومة السرايا للماشية
# =============================================================================
# Usage:
#   .\configure-client.ps1 -Hostname "saraya.local:18443" -StationId "STATION-01" -FarmBranch "المزرعة الرئيسية"
#   .\configure-client.ps1 -Hostname "192.168.1.100:18443" -TestConnection
# =============================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, HelpMessage = "عنوان خادم السرايا (FQDN أو IP)")]
    [ValidateNotNullOrEmpty()]
    [string]$Hostname,

    [Parameter(HelpMessage = "معرّف المحطة")]
    [string]$StationId = "UNCONFIGURED",

    [Parameter(HelpMessage = "اسم الفرع أو المزرعة")]
    [string]$FarmBranch = "المزرعة الرئيسية",

    [Parameter(HelpMessage = "اختبار الاتصال بالخادم قبل الحفظ")]
    [switch]$TestConnection,

    [Parameter(HelpMessage = "مسار مخصص لحفظ ملف التكوين")]
    [string]$ConfigPath
)

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Resolve the configuration file path
# Priority: explicit param > ProgramData (admin) > per-user AppData
# ---------------------------------------------------------------------------
function Resolve-ConfigPath {
    if ($ConfigPath) {
        return $ConfigPath
    }

    $programDataPath = Join-Path $env:ProgramData 'SarayaLivestock\client.json'
    $userDataPath    = Join-Path $env:APPDATA 'saraya-livestock-desktop\client.json'

    # Try ProgramData first (machine-wide, requires admin)
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator
    )
    if ($isAdmin) {
        return $programDataPath
    }

    # Check if ProgramData path already exists and is writable
    $programDataDir = Split-Path $programDataPath -Parent
    if (Test-Path $programDataDir) {
        try {
            $testFile = Join-Path $programDataDir '.write-test'
            [System.IO.File]::WriteAllText($testFile, '')
            Remove-Item $testFile -Force -ErrorAction SilentlyContinue
            return $programDataPath
        }
        catch {
            # Not writable, fall through to user path
        }
    }

    return $userDataPath
}

# ---------------------------------------------------------------------------
# Test connectivity to the Saraya server
# ---------------------------------------------------------------------------
function Test-SarayaConnection {
    param([string]$ServerHostname)

    Write-Host "`n[*] جاري اختبار الاتصال بالخادم: $ServerHostname ..." -ForegroundColor Cyan

    try {
        $serverUri = [Uri]("https://" + $ServerHostname)
        $dnsHostname = $serverUri.DnsSafeHost
    }
    catch {
        Write-Host "    [!!] عنوان الخادم غير صالح: '$ServerHostname'" -ForegroundColor Yellow
        return $false
    }

    # 1. DNS/IP resolution
    try {
        $resolved = [System.Net.Dns]::GetHostAddresses($dnsHostname)
        Write-Host "    [OK] تم حل العنوان: $($resolved[0])" -ForegroundColor Green
    }
    catch {
        Write-Host "    [!!] تعذر حل اسم المضيف '$ServerHostname'" -ForegroundColor Yellow
        Write-Host "         تأكد من إعدادات DNS أو أضف العنوان في ملف hosts" -ForegroundColor Gray
        return $false
    }

    # 2. HTTPS connectivity
    $apiUrl = "https://${ServerHostname}/api/v1/health"
    try {
        # Allow self-signed certificates (Caddy internal CA)
        if (-not ([System.Management.Automation.PSTypeName]'TrustAll').Type) {
            Add-Type @"
using System.Net;
using System.Net.Security;
using System.Security.Cryptography.X509Certificates;
public class TrustAll {
    public static void Enable() {
        ServicePointManager.ServerCertificateValidationCallback =
            delegate { return true; };
    }
}
"@
        }
        [TrustAll]::Enable()
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

        $response = Invoke-WebRequest -Uri $apiUrl -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "    [OK] خادم API يعمل ويستجيب (HTTP 200)" -ForegroundColor Green
            return $true
        }
    }
    catch {
        Write-Host "    [!!] تعذر الاتصال بخادم API على $apiUrl" -ForegroundColor Yellow
        Write-Host "         الخادم قد يكون غير مُشَغَّل أو جدار الحماية يمنع الاتصال" -ForegroundColor Gray
        return $false
    }
    return $false
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " أداة تهيئة محطة السرايا للماشية" -ForegroundColor Cyan
Write-Host " Saraya Livestock Client Configuration" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Test connection if requested
if ($TestConnection) {
    $connected = Test-SarayaConnection -ServerHostname $Hostname
    if (-not $connected) {
        Write-Host "`n[?] هل تريد المتابعة رغم فشل اختبار الاتصال؟ (y/n): " -ForegroundColor Yellow -NoNewline
        $confirm = Read-Host
        if ($confirm -ne 'y' -and $confirm -ne 'Y') {
            Write-Host "[X] تم الإلغاء." -ForegroundColor Red
            exit 1
        }
    }
}

# Resolve target path
$targetPath = Resolve-ConfigPath
$targetDir  = Split-Path $targetPath -Parent

Write-Host "`n[*] إعدادات التكوين:" -ForegroundColor White
Write-Host "    عنوان الخادم : $Hostname"
Write-Host "    معرّف المحطة : $StationId"
Write-Host "    اسم الفرع    : $FarmBranch"
Write-Host "    مسار الحفظ   : $targetPath"

# Create directory if needed
if (-not (Test-Path $targetDir)) {
    New-Item -Path $targetDir -ItemType Directory -Force | Out-Null
    Write-Host "`n[+] تم إنشاء المجلد: $targetDir" -ForegroundColor Green
}

# Backup existing config
if (Test-Path $targetPath) {
    $backupPath = "${targetPath}.bak.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item -Path $targetPath -Destination $backupPath -Force
    Write-Host "[~] تم حفظ نسخة احتياطية: $backupPath" -ForegroundColor DarkYellow
}

# Write client.json
$config = @{
    apiBaseUrl = "https://${Hostname}/api/v1"
    stationId  = $StationId
    farmBranch = $FarmBranch
} | ConvertTo-Json -Depth 2

[System.IO.File]::WriteAllText($targetPath, $config, [System.Text.Encoding]::UTF8)

Write-Host "`n[OK] تم حفظ ملف التكوين بنجاح!" -ForegroundColor Green
Write-Host ""
exit 0
