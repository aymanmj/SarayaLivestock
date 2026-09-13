<#
.SYNOPSIS
    Vendor Binaries Download Script
#>
[CmdletBinding()]
param (
    [string]$OutputDir = "installer\server\vendor"
)

$ErrorActionPreference = 'Stop'

try {
    Write-Host "Starting vendor binaries download..."
    
    if (-not (Test-Path -LiteralPath $OutputDir)) {
        New-Item -ItemType Directory -Path $OutputDir | Out-Null
    }
    
    $downloadsDir = Join-Path $OutputDir "downloads"
    if (-not (Test-Path -LiteralPath $downloadsDir)) {
        New-Item -ItemType Directory -Path $downloadsDir | Out-Null
    }

    $binaries = @(
        @{
            Name = "Node.js"
            Version = "22.17.0"
            Url = "https://nodejs.org/dist/v22.17.0/node-v22.17.0-win-x64.zip"
            ExpectedHash = "PLACEHOLDER_NODEJS_HASH" 
            DestSubdir = "node"
            IsZip = $true
        },
        @{
            Name = "PostgreSQL"
            Version = "16.9"
            Url = "https://get.enterprisedb.com/postgresql/postgresql-16.9-1-windows-x64-binaries.zip"
            ExpectedHash = "PLACEHOLDER_POSTGRESQL_HASH"
            DestSubdir = "postgresql"
            IsZip = $true
        },
        @{
            Name = "Caddy"
            Version = "2.9.1"
            Url = "https://github.com/caddyserver/caddy/releases/download/v2.9.1/caddy_2.9.1_windows_amd64.zip"
            ExpectedHash = "PLACEHOLDER_CADDY_HASH"
            DestSubdir = "caddy"
            IsZip = $true
        },
        @{
            Name = "WinSW"
            Version = "2.12.0"
            Url = "https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe"
            ExpectedHash = "923111C7142B3DC783A3C722B19B8A21BCB78222D7A136AC33F0CA8A29F4CB66"
            DestSubdir = "winsw"
            IsZip = $false
        }
    )

    $manifestEntries = @()

    foreach ($bin in $binaries) {
        $fileName = Split-Path $bin.Url -Leaf
        $downloadPath = Join-Path $downloadsDir $fileName
        
        if (-not (Test-Path -LiteralPath $downloadPath)) {
            Write-Host "`nDownloading $($bin.Name) v$($bin.Version)..."
            Invoke-WebRequest -Uri $bin.Url -OutFile $downloadPath -UseBasicParsing
        } else {
            Write-Host "`nFound cached download for $($bin.Name) v$($bin.Version)..."
        }
        
        Write-Host "Verifying hash..."
        $actualHash = (Get-FileHash -Path $downloadPath -Algorithm SHA256).Hash
        
        if ($bin.ExpectedHash -like "PLACEHOLDER_*") {
            Write-Warning "Placeholder hash detected for $($bin.Name). Please update script with: $actualHash"
        } elseif ($actualHash -ne $bin.ExpectedHash) {
            Write-Warning "Hash mismatch for $($bin.Name)! Expected $($bin.ExpectedHash), got $actualHash"
        } else {
            Write-Host "Hash verified successfully."
        }
        
        $destPath = Join-Path $OutputDir $bin.DestSubdir
        if (-not (Test-Path -LiteralPath $destPath)) {
            New-Item -ItemType Directory -Path $destPath | Out-Null
        }
        
        if ($bin.IsZip) {
            Write-Host "Extracting archive using tar (fast)..."
            # Extract to a temp directory first
            $tempExtract = Join-Path $OutputDir "temp_$($bin.Name)"
            if (Test-Path -LiteralPath $tempExtract) { Remove-Item -LiteralPath $tempExtract -Recurse -Force }
            New-Item -ItemType Directory -Path $tempExtract | Out-Null
            & tar.exe -xf $downloadPath -C $tempExtract

            # Move inner contents to destPath
            $extractedItems = Get-ChildItem -Path $tempExtract
            if ($extractedItems.Count -eq 1 -and $extractedItems[0].PSIsContainer) {
                $innerDir = $extractedItems[0].FullName
                Get-ChildItem -Path $innerDir | Move-Item -Destination $destPath -Force
            } else {
                Get-ChildItem -Path $tempExtract | Move-Item -Destination $destPath -Force
            }
            Remove-Item -LiteralPath $tempExtract -Recurse -Force
        } else {
            Write-Host "Copying binary..."
            if ($bin.Name -eq "WinSW") {
                Copy-Item -Path $downloadPath -Destination (Join-Path $destPath "WinSW.exe") -Force
            } else {
                Copy-Item -Path $downloadPath -Destination $destPath -Force
            }
        }
        
        $manifestEntries += @{
            name = $bin.Name
            version = $bin.Version
            file = $fileName
            sha256 = $actualHash
            download_date = (Get-Date -Format "yyyy-MM-dd HH:mm:ssZ")
        }
    }

    Write-Host "`nCreating vendor manifest..."
    $manifestPath = Join-Path $OutputDir "vendor-manifest.json"
    $manifestEntries | ConvertTo-Json | Set-Content -Path $manifestPath -Encoding UTF8

    Write-Host "Vendor binaries downloaded and prepared successfully!"
    exit 0
}
catch {
    Write-Error "Failed to download vendor binaries: $_"
    exit 1
}
