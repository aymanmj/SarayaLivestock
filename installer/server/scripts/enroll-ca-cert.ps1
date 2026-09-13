<#
.SYNOPSIS
    CA Certificate Enrollment Script / نص تسجيل شهادة المرجع المصدق
.DESCRIPTION
    Extracts and installs the Caddy internal CA certificate.
    يقوم باستخراج وتثبيت شهادة المرجع المصدق الداخلي لخادم Caddy.
#>
[CmdletBinding()]
param (
    [Parameter(Mandatory=$true)]
    [string]$DataDir,

    [string]$ExportPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

try {
    Write-Host "Starting CA Certificate enrollment... / بدء تسجيل شهادة المرجع المصدق..."
    
    $certPath = Join-Path $DataDir "data\caddy\caddy\pki\authorities\local\root.crt"
    
    # If root.crt doesn't exist yet, trigger a TLS connection to Caddy to generate it
    if (-not (Test-Path $certPath)) {
        try {
            $req = [System.Net.WebRequest]::Create("https://127.0.0.1/")
            $req.Timeout = 3000
            $req.ServerCertificateValidationCallback = { $true }
            $resp = $req.GetResponse()
            $resp.Close()
        } catch {}
        Start-Sleep -Seconds 1
    }

    if (Test-Path $certPath) {
        Write-Host "Importing certificate to Trusted Root CA store... / استيراد الشهادة إلى مخزن الشهادات الموثوقة..."
        $importedCert = Import-Certificate -FilePath $certPath -CertStoreLocation "Cert:\LocalMachine\Root"
        
        if ($importedCert) {
            Write-Host "Certificate imported successfully! / تم استيراد الشهادة بنجاح!"
            if ($ExportPath) {
                Copy-Item -Path $certPath -Destination $ExportPath -Force
            }
        }
    } else {
        Write-Host "CA certificate will be generated on first client connection."
    }

    exit 0
}
catch {
    Write-Host "Certificate enrollment completed with notice: $_"
    exit 0
}
