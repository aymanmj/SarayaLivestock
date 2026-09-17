# Self-elevate to Administrator if not already elevated
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$ErrorActionPreference = 'Stop'
$envFile = 'C:\ProgramData\SarayaLivestock\config\server.env'
$nodeExe = 'E:\Program Files\Saraya Livestock Server\node\node.exe'
$serverDir = 'E:\Program Files\Saraya Livestock Server\server'
$resetScript = 'E:\SarayaLivestock\apps\api\dist\cli\reset-admin-password.js'

if (-not (Test-Path $envFile)) {
    Write-Host "Error: server.env not found at $envFile" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Saraya Livestock - Reset Administrator Password" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$newPass = "Admin@123456"
$env:NODE_PATH = "$serverDir\node_modules"

Write-Host "Resetting administrator password to: $newPass" -ForegroundColor Yellow
& $nodeExe $resetScript $newPass "admin"

Write-Host ""
Write-Host "Login URL: https://saraya.local:18443" -ForegroundColor Green
Write-Host "Username : admin" -ForegroundColor Green
Write-Host "Password : $newPass" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
Read-Host "Done! Press Enter to close"
