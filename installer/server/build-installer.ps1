
$ErrorActionPreference = "Stop"
Write-Host "Updating API dependencies..."
Copy-Item -Path "..\..\apps\api\package.json" -Destination "prod_build\package.json" -Force
Copy-Item -Path "..\..\apps\api\package-lock.json" -Destination "prod_build\package-lock.json" -Force

Write-Host "Removing postinstall from prod_build/package.json..."
$pkg = Get-Content "prod_build\package.json" | ConvertFrom-Json
$pkg.scripts.PSObject.Properties.Remove("postinstall")
$pkg | ConvertTo-Json -Depth 10 | Set-Content "prod_build\package.json" -Encoding UTF8

Write-Host "Running npm ci in prod_build..."
Push-Location prod_build
npm ci --omit=dev --no-fund --no-audit
Pop-Location

Write-Host "Copying Prisma Client from apps/api to prod_build..."
if (Test-Path "prod_build\node_modules\@prisma\client") {
    Remove-Item -Recurse -Force "prod_build\node_modules\@prisma\client"
}
if (Test-Path "prod_build\node_modules\.prisma\client") {
    Remove-Item -Recurse -Force "prod_build\node_modules\.prisma\client"
}
Copy-Item -Path "..\..\apps\api\node_modules\@prisma\client" -Destination "prod_build\node_modules\@prisma\" -Recurse -Force
Copy-Item -Path "..\..\apps\api\node_modules\.prisma\client" -Destination "prod_build\node_modules\.prisma\" -Recurse -Force

Write-Host "Compiling InnoSetup Installer..."
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" "saraya-server.iss"
Write-Host "Done!"

