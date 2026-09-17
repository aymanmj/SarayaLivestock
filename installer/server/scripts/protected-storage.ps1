Set-StrictMode -Version Latest

function Assert-OrdinaryPath([string]$Path) {
    $resolved = [IO.Path]::GetFullPath($Path)
    $part = $resolved
    while ($part) {
        if ((Test-Path -LiteralPath $part) -and ((Get-Item -LiteralPath $part -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw "Reparse points are not allowed in protected storage: $part"
        }
        $parent = Split-Path -Parent $part
        if ($parent -eq $part) { break }
        $part = $parent
    }
    return $resolved
}

function New-StorageAcl([bool]$IsDirectory, [switch]$ServiceRead, [switch]$ServiceModify) {
    # Build the complete DACL, rather than granting over stale explicit rules.
    $acl = if ($IsDirectory) { New-Object Security.AccessControl.DirectorySecurity } else { New-Object Security.AccessControl.FileSecurity }
    $acl.SetAccessRuleProtection($true, $false)
    $inheritance = if ($IsDirectory) { [Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit' } else { [Security.AccessControl.InheritanceFlags]::None }
    $rights = [ordered]@{ 'S-1-5-18' = 'FullControl'; 'S-1-5-32-544' = 'FullControl' }
    if ($ServiceRead -or $ServiceModify) { $rights['S-1-5-20'] = if ($ServiceModify) { 'Modify' } else { 'ReadAndExecute' } }
    foreach ($sid in $rights.Keys) {
        $identity = New-Object Security.Principal.SecurityIdentifier($sid)
        $rule = New-Object Security.AccessControl.FileSystemAccessRule($identity, [Security.AccessControl.FileSystemRights]$rights[$sid], $inheritance, [Security.AccessControl.PropagationFlags]::None, [Security.AccessControl.AccessControlType]::Allow)
        $acl.AddAccessRule($rule)
    }
    return $acl
}

function Protect-Storage([string]$Path, [switch]$ServiceRead, [switch]$ServiceModify, [switch]$FarmLayout) {
    $resolved = Assert-OrdinaryPath $Path
    if (-not (Test-Path -LiteralPath $resolved)) { New-Item -ItemType Directory -Path $resolved | Out-Null }
    [Console]::WriteLine("SARAYA_PROGRESS|acl|0|1")
    
    $icacls = Join-Path $env:windir 'System32\icacls.exe'
    
    & $icacls $resolved /grant:r "*S-1-5-32-544:(OI)(CI)F" "*S-1-5-18:(OI)(CI)F" /Q | Out-Null
    & $icacls $resolved /inheritance:r /Q | Out-Null
    & $icacls $resolved /remove:g "*S-1-1-0" "*S-1-5-11" "*S-1-5-32-545" /Q | Out-Null
    
    if ($ServiceModify) {
        & $icacls $resolved /grant:r "*S-1-5-20:(OI)(CI)F" /Q | Out-Null
    } elseif ($ServiceRead) {
        & $icacls $resolved /grant:r "*S-1-5-20:(OI)(CI)RX" /Q | Out-Null
    }
    
    if ($FarmLayout) {
        $c = Join-Path $resolved 'config'
        $d = Join-Path $resolved 'data'
        $l = Join-Path $resolved 'logs'
        if (Test-Path $c) { & $icacls $c /grant:r "*S-1-5-20:(OI)(CI)RX" /Q | Out-Null }
        if (Test-Path $d) { & $icacls $d /grant:r "*S-1-5-20:(OI)(CI)F" /Q | Out-Null }
        if (Test-Path $l) { & $icacls $l /grant:r "*S-1-5-20:(OI)(CI)F" /Q | Out-Null }
    }
    
    [Console]::WriteLine("SARAYA_PROGRESS|acl|1|1")
}

function Get-SnapshotHash([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '') }
    finally { $sha.Dispose(); $stream.Dispose() }
}

function Copy-VerifiedDirectory([string]$Source, [string]$Destination, [string]$InventoryRoot, [string]$Stage) {
    $sourceRoot = Assert-OrdinaryPath $Source
    $destinationRoot = Assert-OrdinaryPath $Destination
    $items = @(Get-ChildItem -LiteralPath $sourceRoot -Recurse -Force)
    if ($items | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) { throw 'Snapshot source contains reparse points' }
    $files = @($items | Where-Object { -not $_.PSIsContainer })
    [Console]::WriteLine("SARAYA_PROGRESS|$Stage|0|$($files.Count)")
    [IO.Directory]::CreateDirectory($destinationRoot) | Out-Null
    foreach ($directory in $items | Where-Object { $_.PSIsContainer }) {
        $relative = $directory.FullName.Substring($sourceRoot.Length).TrimStart('\')
        [IO.Directory]::CreateDirectory((Join-Path $destinationRoot $relative)) | Out-Null
    }
    $processed = 0
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($sourceRoot.Length).TrimStart('\')
        $target = Join-Path $destinationRoot $relative
        [IO.File]::Copy($file.FullName, $target, $false)
        $hash = Get-SnapshotHash $file.FullName
        if ((Get-SnapshotHash $target) -ne $hash) { throw 'Snapshot checksum mismatch' }
        @{ path = $file.FullName.Substring($InventoryRoot.Length).TrimStart('\'); sha256 = $hash }
        $processed++
        if ($processed % 50 -eq 0 -or $processed -eq $files.Count) {
            [Console]::WriteLine("SARAYA_PROGRESS|$Stage|$processed|$($files.Count)")
        }
    }
}

function Set-PostgresEnvironment([string]$EnvFile) {
    $line = Get-Content -LiteralPath $EnvFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
    if (-not $line) { throw 'Missing DATABASE_URL' }
    $uri = [Uri]($line.Substring(13).Trim().Trim('"').Trim("'"))
    if ($uri.Scheme -notin @('postgres', 'postgresql')) { throw 'Invalid PostgreSQL URL' }
    $credentials = $uri.UserInfo.Split(':', 2)
    if ($credentials.Count -ne 2) { throw 'Missing database credentials' }
    $env:PGHOST = $uri.Host
    $env:PGPORT = if ($uri.Port -gt 0) { [string]$uri.Port } else { '5432' }
    $env:PGUSER = [Uri]::UnescapeDataString($credentials[0])
    $env:PGPASSWORD = [Uri]::UnescapeDataString($credentials[1])
    $env:PGDATABASE = [Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/'))
    $env:PGCONNECT_TIMEOUT = '10'
    if ($env:PGDATABASE -notmatch '^[a-zA-Z0-9_]+$') { throw 'Unsupported database name' }
}

function Invoke-PgTool([string]$Program, [string[]]$Arguments) {
    # Windows PowerShell turns native stderr into terminating errors under Stop.
    # Capture it privately; expose only the executable and exit status, never credentials.
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & $Program @Arguments 2>&1
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previous }
    if ($code -ne 0) { throw "$(Split-Path -Leaf $Program) failed (exit $code)" }
}
