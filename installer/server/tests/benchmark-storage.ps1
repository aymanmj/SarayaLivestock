param([Parameter(Mandatory=$true)][string]$Helper, [Parameter(Mandatory=$true)][string]$Report)
$ErrorActionPreference = 'Stop'
. $Helper
$root = Join-Path ([IO.Path]::GetTempPath()) ('saraya-acl-benchmark-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $root | Out-Null
try {
    foreach ($index in 1..500) { [IO.File]::WriteAllText((Join-Path $root "$index.txt"), 'synthetic fixture') }
    $first = Measure-Command { Protect-Storage $root }
    $repeat = Measure-Command { Protect-Storage $root }
    @{ files = 500; firstSeconds = $first.TotalSeconds; repeatSeconds = $repeat.TotalSeconds } |
        ConvertTo-Json | Set-Content -LiteralPath $Report -Encoding UTF8
} finally {
    $resolved = [IO.Path]::GetFullPath($root)
    $temp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (-not $resolved.StartsWith($temp, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path -Leaf $resolved) -notlike 'saraya-acl-benchmark-*') { throw 'Unsafe cleanup target' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
