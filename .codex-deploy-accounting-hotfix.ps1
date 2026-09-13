$ErrorActionPreference = 'Stop'

$sourceDist = 'E:\SarayaLivestock\apps\api\dist'
$installedDist = 'E:\Program Files\Saraya Livestock\server\dist'
$backupRoot = 'C:\ProgramData\SarayaLivestock\backups'
$backupDir = Join-Path $backupRoot ("api-hotfix-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))

if (-not (Test-Path -LiteralPath (Join-Path $sourceDist 'main.js'))) {
    throw 'Built API main.js was not found.'
}
if (-not (Test-Path -LiteralPath $installedDist)) {
    throw 'Installed API dist directory was not found.'
}

New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item -LiteralPath $installedDist -Destination $backupDir -Recurse -Force

Stop-Service -Name 'SarayaAPI' -Force
Copy-Item -Path (Join-Path $sourceDist '*') -Destination $installedDist -Recurse -Force
Start-Service -Name 'SarayaAPI'

$deadline = (Get-Date).AddSeconds(90)
do {
    Start-Sleep -Seconds 2
    try {
        $health = Invoke-RestMethod -Uri 'http://127.0.0.1:4000/api/v1/system/health/ready' -TimeoutSec 5
    }
    catch {
        $health = $null
    }
} while (($health.status -ne 'ready') -and ((Get-Date) -lt $deadline))

if (($health.status -ne 'ready') -or ($health.database -ne 'connected')) {
    throw 'API did not return ready/connected after the accounting hotfix.'
}

Write-Output "ApiHotfixBackup=$backupDir"
Write-Output 'ApiHotfixDeployment=OK'
