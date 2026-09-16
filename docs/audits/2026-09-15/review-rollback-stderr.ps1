# Review probe: synthetic invalid URI, rejected before a database connection.
$ErrorActionPreference = 'Stop'
$psqlPath = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
try {
    & $psqlPath -d 'postgresql://dummy:dummy@127.0.0.1:1/dummy?schema=public' -c 'SELECT 1' 2>$null
    Write-Output ('FALLBACK_REACHED: exit=' + $LASTEXITCODE)
}
catch {
    Write-Output ('CATCH_BEFORE_FALLBACK: ' + $_.FullyQualifiedErrorId)
}
Write-Output ('POWERSHELL_VERSION: ' + $PSVersionTable.PSVersion)
