<#
.SYNOPSIS
Configures Windows Firewall rules for Saraya Livestock.
تكوين قواعد جدار حماية ويندوز لنظام سرايا للثروة الحيوانية

.DESCRIPTION
Removes existing rules and creates new inbound rules for HTTP/HTTPS access on the local subnet.
إزالة القواعد الحالية وإنشاء قواعد واردة جديدة للوصول عبر HTTP/HTTPS في الشبكة المحلية
#>

[CmdletBinding()]
param ()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

try {
    Write-Output "Configuring Windows Firewall / تكوين جدار حماية ويندوز"

    # 1. Remove existing rules / إزالة القواعد الحالية
    $existingRules = Get-NetFirewallRule | Where-Object { $_.DisplayName -like "Saraya Livestock*" }
    if ($existingRules) {
        Write-Output "Removing existing firewall rules / إزالة قواعد جدار الحماية الحالية"
        $existingRules | Remove-NetFirewallRule
    }

    # 2. Create inbound rule for HTTPS / إنشاء قاعدة واردة لـ HTTPS
    Write-Output "Creating HTTPS rule / إنشاء قاعدة HTTPS"
    New-NetFirewallRule -DisplayName "Saraya Livestock HTTPS (18443)" `
                        -Direction Inbound `
                        -LocalPort 18443 `
                        -Protocol TCP `
                        -Profile Private `
                        -RemoteAddress LocalSubnet `
                        -Action Allow `
                        -ErrorAction Stop | Out-Null

    # 3. Create inbound rule for HTTP / إنشاء قاعدة واردة لـ HTTP
    Write-Output "Creating HTTP rule / إنشاء قاعدة HTTP"
    New-NetFirewallRule -DisplayName "Saraya Livestock HTTP (18080)" `
                        -Direction Inbound `
                        -LocalPort 18080 `
                        -Protocol TCP `
                        -Profile Private `
                        -RemoteAddress LocalSubnet `
                        -Action Allow `
                        -ErrorAction Stop | Out-Null

    # 4. Verify rules were created / التحقق من إنشاء القواعد
    $httpsRule = Get-NetFirewallRule -DisplayName "Saraya Livestock HTTPS (18443)" -ErrorAction SilentlyContinue
    $httpRule = Get-NetFirewallRule -DisplayName "Saraya Livestock HTTP (18080)" -ErrorAction SilentlyContinue

    if (-not $httpsRule -or -not $httpRule) {
        throw "Verification failed: One or more rules were not created properly / فشل التحقق: لم يتم إنشاء قاعدة واحدة أو أكثر بشكل صحيح"
    }

    Write-Output "Firewall configured successfully / تم تكوين جدار الحماية بنجاح"
    exit 0
}
catch {
    Write-Error "Failed to configure firewall / فشل في تكوين جدار الحماية: $($_.Exception.Message)"
    exit 1
}
