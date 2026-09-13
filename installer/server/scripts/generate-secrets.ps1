<#
.SYNOPSIS
Generates cryptographically random secrets and writes them to server.env.
إنشاء أسرار عشوائية آمنة وكتابتها في ملف إعدادات الخادم

.DESCRIPTION
This script generates secure random hex strings for DB_PASSWORD, JWT_SECRET, and ENCRYPTION_KEY.
It then replaces the placeholders in the environment file.
يقوم هذا السكربت بإنشاء سلاسل نصية عشوائية آمنة واستبدال العناصر النائبة في ملف البيئة
#>

[CmdletBinding()]
param (
    [Parameter(Mandatory=$true)]
    [string]$EnvFilePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

try {
    Write-Output "Starting secret generation / بدء إنشاء الأسرار"

    if (-not (Test-Path $EnvFilePath)) {
        throw "Environment file not found / لم يتم العثور على ملف البيئة: $EnvFilePath"
    }

    # Function to generate secure random hex string / دالة لإنشاء سلسلة نصية عشوائية آمنة
    function New-SecureRandomHex {
        param (
            [int]$Length
        )
        $bytes = New-Object byte[] ($Length / 2)
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        $rng.GetBytes($bytes)
        $rng.Dispose()
        
        $hexString = [BitConverter]::ToString($bytes) -replace '-'
        return $hexString.ToLower()
    }

    # Generate secrets / إنشاء الأسرار
    $dbPassword = New-SecureRandomHex -Length 32
    $jwtSecret = New-SecureRandomHex -Length 64
    $encryptionKey = New-SecureRandomHex -Length 64

    # Read the file / قراءة الملف
    $content = Get-Content -Path $EnvFilePath -Raw -Encoding UTF8

    # Replace placeholders / استبدال العناصر النائبة
    $content = $content -replace '\{\{DB_PASSWORD\}\}', $dbPassword
    $content = $content -replace '\{\{JWT_SECRET\}\}', $jwtSecret
    $content = $content -replace '\{\{ENCRYPTION_KEY\}\}', $encryptionKey

    # Write back the file securely (using UTF8 with BOM as requested for PowerShell compatibility)
    # حفظ الملف بشكل آمن
    Set-Content -Path $EnvFilePath -Value $content -Encoding UTF8 -Force

    Write-Output "Secrets generated and written successfully / تم إنشاء وحفظ الأسرار بنجاح"
    exit 0
}
catch {
    Write-Error "Failed to generate secrets / فشل في إنشاء الأسرار: $($_.Exception.Message)"
    exit 1
}
