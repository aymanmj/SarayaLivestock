[CmdletBinding()]
param([switch]$ApplyToDisposableDirectory, [string]$ResultPath)
$ErrorActionPreference = 'Stop'
if ($ResultPath) { Start-Transcript -LiteralPath ($ResultPath + '.log') -Force | Out-Null }
. (Join-Path $PSScriptRoot 'protected-storage.ps1')
$section = [Security.AccessControl.AccessControlSections]::Access
foreach ($directory in @($false, $true)) {
    foreach ($mode in @('Private', 'Read', 'Modify')) {
        $acl = New-StorageAcl -IsDirectory $directory -ServiceRead:($mode -eq 'Read') -ServiceModify:($mode -eq 'Modify')
        if (-not $acl.AreAccessRulesProtected) { throw 'Inheritance must be disabled' }
        $rules = @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))
        if ($rules.Count -ne $(if ($mode -eq 'Private') { 2 } else { 3 })) { throw 'Unexpected rule count' }
        if ($rules | Where-Object { $_.IdentityReference.Value -notin @('S-1-5-32-544','S-1-5-18','S-1-5-20') }) { throw 'Unexpected SID' }
        $second = New-StorageAcl -IsDirectory $directory -ServiceRead:($mode -eq 'Read') -ServiceModify:($mode -eq 'Modify')
        if ($acl.GetSecurityDescriptorSddlForm($section) -ne $second.GetSecurityDescriptorSddlForm($section)) { throw 'Unstable DACL' }
    }
}
Write-Output 'DACL construction: six policy cases passed.'
if (-not $ApplyToDisposableDirectory) { return }
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Filesystem ACL tests require an elevated administrator token' }
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('saraya-storage-test-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
try {
    foreach ($name in @('config','backups','logs','data\postgresql','data\caddy')) {
        New-Item -ItemType Directory -Path (Join-Path $testRoot $name) -Force | Out-Null
        Set-Content -LiteralPath (Join-Path $testRoot "$name\fixture.txt") -Value 'synthetic test data'
    }
    # Reproduce stale explicit Users access as well as the service rules from a prior run.
    $stale = Get-Acl -LiteralPath (Join-Path $testRoot 'config')
    $users = New-Object Security.Principal.SecurityIdentifier('S-1-5-32-545')
    $stale.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($users,'ReadAndExecute','Allow')))
    Set-Acl -LiteralPath (Join-Path $testRoot 'config') -AclObject $stale
    Protect-Storage $testRoot -FarmLayout
    $before = @{}
    foreach ($item in Get-ChildItem -LiteralPath $testRoot -Recurse -Force) { $before[$item.FullName] = (Get-Acl -LiteralPath $item.FullName).GetSecurityDescriptorSddlForm($section) }
    Protect-Storage $testRoot -FarmLayout
    foreach ($item in Get-ChildItem -LiteralPath $testRoot -Recurse -Force) {
        if ($before[$item.FullName] -ne (Get-Acl -LiteralPath $item.FullName).GetSecurityDescriptorSddlForm($section)) { throw 'Second run changed permissions' }
    }
    Write-Output 'Filesystem ACL hardening and repeat execution passed.'
} finally {
    $resolvedTest = [IO.Path]::GetFullPath($testRoot)
    $resolvedTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (-not $resolvedTest.StartsWith($resolvedTemp, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path -Leaf $resolvedTest) -notlike 'saraya-storage-test-*') { throw 'Unsafe test cleanup path' }
    Remove-Item -LiteralPath $resolvedTest -Recurse -Force
}
if ($ResultPath) {
    @{ passed = $true; checkedAt = [DateTime]::UtcNow.ToString('o'); checks = @('six DACL policies', 'remove stale explicit Users access', 'repeat filesystem hardening'); productionChanged = $false } | ConvertTo-Json | Set-Content -LiteralPath $ResultPath -Encoding UTF8
    Stop-Transcript | Out-Null
}
