<#
.SYNOPSIS
    Uninstall Services Script / نص إزالة الخدمات
.DESCRIPTION
    Removes all Saraya Livestock Windows services and firewall rules.
    يزيل جميع خدمات ويندوز وقواعد جدار الحماية الخاصة بسرايا للثروة الحيوانية.
#>
[CmdletBinding()]
param (
    [Parameter(Mandatory=$true)]
    [string]$InstallDir
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

try {
    Write-Host "Starting uninstallation of services and rules... / بدء إزالة الخدمات وقواعد جدار الحماية..."

    # 1. Reverse dependency order: Caddy, API, PostgreSQL
    $servicesToRemove = @("SarayaCaddy", "SarayaAPI", "SarayaPostgreSQL")
    $removedServices = @()

    foreach ($service in $servicesToRemove) {
        $svcInfo = Get-Service -Name $service -ErrorAction SilentlyContinue
        if ($svcInfo) {
            Write-Host "Found service: $service / تم العثور على الخدمة"
            
            if ($svcInfo.Status -ne 'Stopped') {
                Write-Host "Stopping $service ... / إيقاف الخدمة..."
                Stop-Service -Name $service -Force
                Start-Sleep -Seconds 2
            }

            $serviceWrapper = Join-Path $InstallDir "services\$service.exe"
            if (Test-Path $serviceWrapper) {
                Write-Host "Uninstalling $service using WinSW... / إزالة الخدمة باستخدام WinSW..."
                $process = Start-Process -FilePath $serviceWrapper -ArgumentList "uninstall" -NoNewWindow -Wait -PassThru
                if ($process.ExitCode -eq 0) {
                    $removedServices += $service
                } else {
                    Write-Warning "WinSW returned exit code $($process.ExitCode) for $service"
                    & sc.exe delete $service | Out-Null
                }
            } else {
                # Fallback to WMI / sc.exe
                Write-Host "Uninstalling $service using sc.exe... / إزالة الخدمة باستخدام sc.exe..."
                & sc.exe delete $service | Out-Null
                $removedServices += $service
            }
        }
    }

    # 2. Remove firewall rules
    Write-Host "Removing firewall rules... / إزالة قواعد جدار الحماية..."
    $firewallRules = Get-NetFirewallRule | Where-Object { $_.DisplayName -match "^Saraya Livestock" }
    $removedRules = @()
    
    foreach ($rule in $firewallRules) {
        Write-Host "Removing rule: $($rule.DisplayName) / إزالة القاعدة..."
        Remove-NetFirewallRule -Name $rule.Name
        $removedRules += $rule.DisplayName
    }

    # 3. Summary
    Write-Host ""
    Write-Host "Uninstallation Summary / ملخص الإزالة:"
    Write-Host "Services Removed / الخدمات المزالة:"
    $removedServices | ForEach-Object { Write-Host " - $_" }
    
    Write-Host "Firewall Rules Removed / قواعد جدار الحماية المزالة:"
    $removedRules | ForEach-Object { Write-Host " - $_" }

    Write-Host "Process completed successfully. / اكتملت العملية بنجاح."
    exit 0
}
catch {
    Write-Error "Uninstallation encountered an error / حدث خطأ أثناء الإزالة: $_"
    # Even on error, we typically want uninstallation to proceed as best-effort
    exit 0 
}
