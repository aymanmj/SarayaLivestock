import sys
p = r'E:\SarayaLivestock\installer\server\scripts\run-migrations.ps1'
with open(p, 'rb') as f:
    lines = f.read().splitlines()
lines = lines[:-4]
lines.extend([
    b'catch {',
    b'    $errMessage = "Failed to run migrations: " + $_.Exception.Message + "
" + $_.ScriptStackTrace',
    b'    $logPath = Join-Path $DataDir "logs\saraya-migration-error.log"',
    b'    $tmpPath = Join-Path $env:TEMP "saraya-migration-error.log"',
    b'    try { [System.IO.File]::WriteAllText($logPath, $errMessage) } catch {}',
    b'    try { [System.IO.File]::WriteAllText($tmpPath, $errMessage) } catch {}',
    b'    Write-Error $errMessage',
    b'    exit 1',
    b'}'
])
with open(p, 'wb') as f:
    f.write(b'\r\n'.join(lines))
