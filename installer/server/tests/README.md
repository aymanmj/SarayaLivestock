# Server installer regression checks

Run from the repository root on Windows:

```powershell
& 'C:\Program Files (x86)\Inno Setup 6\ISCC.exe' /Q installer/server/tests/install-mode.iss
$result = Join-Path (Get-Location) 'dist-installer\tests\result.txt'
Start-Process 'dist-installer\tests\install-mode-test.exe' -ArgumentList "/VERYSILENT /SUPPRESSMSGBOXES /ResultFile=$result" -WindowStyle Hidden -Wait
Get-Content $result
powershell.exe -NoProfile -ExecutionPolicy Bypass -File installer/server/tests/test-repair-backup.ps1
```

The Inno harness runs the same classification function as the server installer.
Its result file must contain `PASS: six installation scenarios`. Setup deliberately
returns from initialization without installing anything; its process exit code is
not the test result.

The backup test runs the actual backup script on synthetic files. Service calls
and ACL application are isolated so it cannot affect the installed server. It
checks preservation of a cluster without an application database, copied hashes,
and rejection of a cluster with a PID file. Production service permissions and
full installation still require an elevated Windows installation test.

## Interrupted installation recovery

A registered installation without `InstallComplete=1` resumes setup. Existing
configuration is preserved. Before files are replaced, the installer stops its
services and saves a verified offline copy of data, configuration, and available
program files under `%ProgramData%\SarayaLivestock\backups\upgrade-*`.

These snapshots have `version: 3` and `kind: incomplete-installation` in their
manifest. They contain the original `data`, `config`, and `installation` folders.
They are recovery material for an interrupted setup, not a working installation
that `rollback.ps1` can automatically restore. That command continues to accept
only verified version 2 logical upgrade backups.

Completed installations retain the logical database backup requirement.
Unregistered clusters and clusters without configuration are treated
conservatively as upgrades, rather than resetting database credentials.

## Preparation progress and storage performance

Compile `preparation-progress.iss` with ISCC, then run its generated executable
with `/VERYSILENT /SUPPRESSMSGBOXES /ResultFile=<absolute-report-path>`.
The report must say `PASS: live progress callbacks and child failure preserved`.
This checks the production progress callback against an actual PowerShell child,
including propagation of a nonzero exit code. Only fixed progress messages are
shown and logged; arbitrary script output is excluded to avoid exposing secrets.

`benchmark-storage.ps1 -Helper <protected-storage.ps1> -Report <report.json>`
requires elevation and measures initial and repeated hardening of 500 temporary
files. It cleans up only its own generated temporary directory. For ACL correctness,
also run `scripts/test-storage.ps1 -ApplyToDisposableDirectory` as administrator.
Cached policies use immutable SDDL: Windows clears the dirty flags of ACL objects
after applying them, so sharing those objects between files is unsafe.

For a faster local packaging iteration, ISCC accepts
`/DInstallerCompression=lzma2/fast`; the default release compression is unchanged.
