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
    $rights = @{'S-1-5-32-544' = 'FullControl'; 'S-1-5-18' = 'FullControl'}
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
    $items = @((Get-Item -LiteralPath $resolved -Force)) + @(Get-ChildItem -LiteralPath $resolved -Recurse -Force)
    foreach ($item in $items) {
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Reparse point in protected storage" }
        
        $read = [bool]$ServiceRead
        $modify = [bool]$ServiceModify
        if ($FarmLayout) {
            $relative = $item.FullName.Substring($resolved.TrimEnd('\').Length).TrimStart('\')
            $read = $relative -match '^config(\\|$)'
            $modify = $relative -match '^(data\\postgresql|data\\caddy|logs)(\\|$)'
        }
        $desired = New-StorageAcl -IsDirectory $item.PSIsContainer -ServiceRead:$read -ServiceModify:$modify
        Set-Acl -LiteralPath $item.FullName -AclObject $desired -ErrorAction Stop

        # Verification: check with Get-Acl that only allowed SIDs exist and no unexpected access (e.g. Users) is allowed
        $actual = Get-Acl -LiteralPath $item.FullName
        $allowed = @('S-1-5-32-544', 'S-1-5-18')
        if ($read -or $modify) { $allowed += 'S-1-5-20' }
        foreach ($rule in $actual.Access) {
            $sid = $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
            if ($rule.AccessControlType -eq 'Allow' -and $sid -notin $allowed) {
                throw "Unexpected access rule on $($item.FullName): SID $sid ($($rule.IdentityReference.Value))"
            }
        }
        # Verify exact rights and protection too, not just absence of extra SIDs.
        $section = [Security.AccessControl.AccessControlSections]::Access
        if ($actual.GetSecurityDescriptorSddlForm($section) -ne $desired.GetSecurityDescriptorSddlForm($section)) {
            throw "Storage permissions did not match the required DACL: $($item.FullName)"
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
