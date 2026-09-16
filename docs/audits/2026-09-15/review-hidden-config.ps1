# Review-only fixture. No installer execution, ACL changes, or service access.
$ErrorActionPreference = 'Stop'
$probeRoot = Join-Path $PSScriptRoot ('hidden-config-' + [Guid]::NewGuid().ToString('N'))
$source = Join-Path $probeRoot 'source'
$snapshot = Join-Path $probeRoot 'config'
New-Item -ItemType Directory -Path $source | Out-Null
Set-Content -LiteralPath (Join-Path $source 'server.env') -Value 'REVIEW_FIXTURE_ONLY=true'
$hidden = Join-Path $source 'hidden-settings.txt'
Set-Content -LiteralPath $hidden -Value 'Synthetic hidden config fixture; no secrets.'
(Get-Item -LiteralPath $hidden).Attributes = [IO.FileAttributes]::Hidden
# Match pre-upgrade-backup.ps1:48-50.
Copy-Item -LiteralPath $source -Destination $snapshot -Recurse -Force
$manifestFiles = @(Get-ChildItem -LiteralPath $snapshot -Recurse -File | ForEach-Object {
    @{ path = $_.FullName.Substring($snapshot.Length).TrimStart('\'); sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash }
})
# Match rollback.ps1:17-19.
$actual = @(Get-ChildItem -LiteralPath $snapshot -Recurse -Force)
$actualFiles = @($actual | Where-Object { -not $_.PSIsContainer })
$result = [ordered]@{
    fixtureDirectory = $probeRoot
    manifestFileCount = $manifestFiles.Count
    actualFileCount = $actualFiles.Count
    omittedFiles = @($actualFiles.Name | Where-Object { $_ -notin $manifestFiles.path })
    rollbackRejectsSnapshot = ($actualFiles.Count -ne $manifestFiles.Count)
    limitations = 'Synthetic filesystem fixture only; no live config, ACL, services, or database changes.'
}
$result | ConvertTo-Json | Tee-Object -FilePath (Join-Path $PSScriptRoot 'review-hidden-config-result.json')
if (-not $result.rollbackRejectsSnapshot) { throw 'Expected snapshot mismatch was not reproduced' }
