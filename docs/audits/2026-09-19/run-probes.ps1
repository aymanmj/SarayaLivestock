$ErrorActionPreference = 'Stop'
$repo = 'E:\SarayaLivestock'
$bin = Join-Path $repo 'installer\server\vendor\postgresql\bin'
$root = Join-Path ([IO.Path]::GetTempPath()) ('saraya-release-review-' + [Guid]::NewGuid().ToString('N'))
$probe = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, 0)
$probe.Start()
$port = $probe.LocalEndpoint.Port
$probe.Stop()
$started = $false
New-Item -ItemType Directory -Path $root | Out-Null
try {
    & "$bin\initdb.exe" -D "$root\data" -U postgres --auth=trust --no-locale --encoding=UTF8
    if ($LASTEXITCODE -ne 0) { throw 'Disposable cluster initialization failed' }
    & "$bin\pg_ctl.exe" start -D "$root\data" -l "$root\postgres.log" -o "-h 127.0.0.1 -p $port" -w -t 30
    if ($LASTEXITCODE -ne 0) { throw 'Disposable cluster startup failed' }
    $started = $true
    & "$bin\createdb.exe" -h 127.0.0.1 -p $port -U postgres review_release
    if ($LASTEXITCODE -ne 0) { throw 'Disposable database creation failed' }
    $env:DATABASE_URL = "postgresql://postgres@127.0.0.1:$port/review_release"
    $env:SARAYA_REVIEW_DB_URL = $env:DATABASE_URL
    Push-Location "$repo\apps\api"
    try {
        & node node_modules/prisma/build/index.js migrate deploy
        if ($LASTEXITCODE -ne 0) { throw 'Review migrations failed' }
        $env:RUN_DB_INTEGRATION_TESTS = 'true'
        & node "$repo\docs\audits\2026-09-19\hr-postgres-probe.cjs"
        if ($LASTEXITCODE -ne 0) { throw 'HR probe failed' }
        & node "$repo\docs\audits\2026-09-19\security-postgres.cjs"
        if ($LASTEXITCODE -ne 0) { throw 'Review tests failed' }
    } finally { Pop-Location }
} finally {
    if ($started) { & "$bin\pg_ctl.exe" stop -D "$root\data" -m fast -w -t 30 }
    if (Test-Path "$root\data\postmaster.pid") { throw "Review cluster still running; retained at $root" }
    $resolved = [IO.Path]::GetFullPath($root)
    $temp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (-not $resolved.StartsWith($temp, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path -Leaf $resolved) -notlike 'saraya-release-review-*') { throw 'Unsafe test cleanup target' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}



