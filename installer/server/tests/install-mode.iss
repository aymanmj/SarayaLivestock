[Setup]
AppName=Saraya installation mode regression
AppVersion=1
DefaultDirName={tmp}\SarayaModeTest
PrivilegesRequired=lowest
Uninstallable=no
CreateAppDir=no
OutputDir=..\..\..\dist-installer\tests
OutputBaseFilename=install-mode-test
[Code]
#include "..\install-mode.iss"
procedure CheckMode(Config, Cluster, Registration, Completed: Boolean;
  Expected: Integer; const Scenario: String);
begin
  if ClassifyInstallation(Config, Cluster, Registration, Completed) <> Expected then
    RaiseException('FAIL: ' + Scenario);
end;
function InitializeSetup(): Boolean;
begin
  Result := False;
  try
    CheckMode(True, True, True, False, 2, 'failed setup with existing cluster must resume');
    CheckMode(True, True, True, True, 1, 'completed installation must upgrade');
    CheckMode(False, False, False, False, 0, 'fresh installation');
    CheckMode(True, False, False, False, 2, 'configuration from failed setup must survive');
    CheckMode(True, True, False, False, 1, 'unregistered existing database needs conservative upgrade');
    CheckMode(False, True, True, True, 1, 'missing configuration must not reset existing database');
    SaveStringToFile(ExpandConstant('{param:ResultFile}'), 'PASS: six installation scenarios', False);
  except
    SaveStringToFile(ExpandConstant('{param:ResultFile}'), GetExceptionMessage, False);
  end;
end;
