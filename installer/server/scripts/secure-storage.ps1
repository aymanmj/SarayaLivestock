[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$DataDir)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'protected-storage.ps1')
try {
    foreach ($relative in @('config', 'backups', 'data\postgresql', 'data\caddy', 'logs')) {
        $path = Assert-OrdinaryPath (Join-Path $DataDir $relative)
        if (-not (Test-Path -LiteralPath $path)) { New-Item -ItemType Directory -Path $path -Force | Out-Null }
    }
    Protect-Storage $DataDir -FarmLayout
    Write-Output 'Protected storage permissions verified.'
    exit 0
} catch {
    $err = "Storage hardening failed; installation must not continue. $($_.Exception.Message)"
    Write-Error $err -ErrorAction Continue
    try {
        $logPath = Join-Path $env:TEMP 'saraya-storage-error.log'
        Set-Content -LiteralPath $logPath -Value "$err`n$($_.ScriptStackTrace)" -Force
    } catch {}
    exit 1
}
