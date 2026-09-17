[Setup]
AppName=Saraya preparation progress regression
AppVersion=1
DefaultDirName={tmp}\SarayaProgressTest
PrivilegesRequired=lowest
Uninstallable=no
CreateAppDir=no
OutputDir=..\..\..\dist-installer\tests
OutputBaseFilename=preparation-progress-test
[Code]
#include "..\preparation-progress.iss"
procedure InitializeWizard();
var
  ScriptPath, Report: String;
  ExitCode: Integer;
begin
  ScriptPath := ExpandConstant('{tmp}\progress-test.ps1');
  SaveStringToFile(ScriptPath,
    '[Console]::WriteLine(''SARAYA_PROGRESS|files|1|2'')' + #13#10 +
    'Start-Sleep -Milliseconds 100' + #13#10 +
    '[Console]::WriteLine(''SARAYA_PROGRESS|files|2|2'')' + #13#10 +
    'exit 7', False);
  if not RunPreparationPowerShell(ScriptPath, '', ExitCode) then
    Report := 'FAIL: process launch'
  else if ExitCode <> 7 then
    Report := 'FAIL: child exit code lost'
  else if PreparationUpdateCount <> 2 then
    Report := 'FAIL: preparation waits without displaying file progress'
  else
    Report := 'PASS: live progress callbacks and child failure preserved';
  SaveStringToFile(ExpandConstant('{param:ResultFile}'), Report, False);
  WizardForm.Close;
end;
