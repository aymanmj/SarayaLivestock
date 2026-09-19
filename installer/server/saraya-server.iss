; =============================================================================
; Saraya Livestock Server Installer — Inno Setup 6 Script
; مثبت خادم منظومة السرايا لإدارة مزارع الماشية والألبان والتسمين
; =============================================================================

#define MyAppName        "Saraya Livestock Server"
#define MyAppNameAr      "خادم منظومة السرايا لإدارة مزارع الماشية والألبان"
#define MyAppVersion     "1.0.0"
#define MyAppPublisher   "Saraya Solutions"
#define MyAppURL         "https://saraya-livestock.com"

#define DefaultHostname  "saraya.local"
#define DefaultClientAddress "saraya.local:18443"
#define DefaultHttpPort  "18080"
#define DefaultHttpsPort "18443"
#define DefaultDbName    "saraya_livestock_prod"
#define DefaultDbUser    "saraya"
#define PostgresMajor    "16"
#define DefaultAdminUser "admin"
#define DefaultOrgName   "المؤسسة"
#define DefaultFarmName  "المزرعة الرئيسية"

; Source directories (relative to this .iss file)
#define VendorDir        "vendor"
#define ConfigDir        "config"
#define ServicesDir      "services"
#define ScriptsDir       "scripts"
#define ApiDistDir       "..\..\apps\api\dist"
#define ApiNodeModules   "..\..\apps\api\node_modules"
#define ApiPrismaDir     "..\..\apps\api\prisma"
#define ApiPackageJson   "..\..\apps\api\package.json"
#define ApiPrismaConfig  "..\..\apps\api\prisma.config.ts"
#define WebDistDir       "..\..\apps\web\dist"

[Setup]
AppId={{8A3F4E2B-C7D1-4E5F-9B8A-1D2E3F4A5B6C}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
DefaultDirName={autopf}\Saraya Livestock
DefaultGroupName=Saraya Livestock
DisableProgramGroupPage=yes
LicenseFile=..\..\LICENSE
OutputDir=..\..\dist-installer
OutputBaseFilename=SarayaLivestock-Server-{#MyAppVersion}-x64-Setup-v13
#ifndef InstallerCompression
  #define InstallerCompression "lzma2/ultra64"
#endif
Compression={#InstallerCompression}
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
SetupLogging=yes
UninstallDisplayName={#MyAppNameAr}
WizardStyle=modern
WizardSizePercent=120
DisableWelcomePage=no
ShowLanguageDialog=no

; Minimum Windows 10 (build 17763 = 1809)
MinVersion=10.0.17763

[Languages]
Name: "arabic"; MessagesFile: "compiler:Languages\Arabic.isl"

[Messages]
arabic.BeveledLabel=منظومة السرايا لإدارة مزارع الماشية والألبان والتسمين

; =============================================================================
; Files Section — Immutable binaries under {app}
; =============================================================================
[Files]
; --- Node.js 22 portable runtime (the installer/runtime only needs node.exe) ---
Source: "{#VendorDir}\node\node.exe"; DestDir: "{app}\node"; Flags: ignoreversion

; --- PostgreSQL 16 portable (runtime only: bin, lib, share) ---
Source: "{#VendorDir}\postgresql\bin\*"; DestDir: "{app}\postgresql\bin"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#VendorDir}\postgresql\lib\*"; DestDir: "{app}\postgresql\lib"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#VendorDir}\postgresql\share\*"; DestDir: "{app}\postgresql\share"; Flags: ignoreversion recursesubdirs createallsubdirs

; --- Caddy web server ---
Source: "{#VendorDir}\caddy\*"; DestDir: "{app}\caddy"; Flags: ignoreversion recursesubdirs createallsubdirs

; --- WinSW service wrappers (bundled mode: executable and XML share a basename) ---
Source: "{#VendorDir}\winsw\WinSW.exe"; DestDir: "{app}\services"; DestName: "SarayaPostgreSQL.exe"; Flags: ignoreversion
Source: "{#VendorDir}\winsw\WinSW.exe"; DestDir: "{app}\services"; DestName: "SarayaAPI.exe"; Flags: ignoreversion
Source: "{#VendorDir}\winsw\WinSW.exe"; DestDir: "{app}\services"; DestName: "SarayaCaddy.exe"; Flags: ignoreversion

; --- WinSW service XML definitions ---
Source: "{#ServicesDir}\SarayaPostgreSQL.xml"; DestDir: "{app}\services"; Flags: ignoreversion
Source: "{#ServicesDir}\SarayaAPI.xml"; DestDir: "{app}\services"; Flags: ignoreversion
Source: "{#ServicesDir}\SarayaCaddy.xml"; DestDir: "{app}\services"; Flags: ignoreversion

; --- API server (NestJS compiled) ---
Source: "{#ApiDistDir}\*"; DestDir: "{app}\server\dist"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "prod_build\node_modules\*"; DestDir: "{app}\server\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#ApiPrismaDir}\*"; DestDir: "{app}\server\prisma"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#ApiPackageJson}"; DestDir: "{app}\server"; Flags: ignoreversion
Source: "{#ApiPrismaConfig}"; DestDir: "{app}\server"; Flags: ignoreversion

; --- Web application (Vite build) ---
Source: "{#WebDistDir}\*"; DestDir: "{app}\web"; Flags: ignoreversion recursesubdirs createallsubdirs

; --- Configuration templates (to temp, processed during install) ---
Source: "{#ConfigDir}\server.env.template"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "{#ConfigDir}\Caddyfile"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "{#ConfigDir}\pg_hba.conf.template"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "{#ConfigDir}\postgresql.conf.template"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "{#ConfigDir}\client.json.template"; DestDir: "{tmp}"; Flags: deleteafterinstall

; --- Helper scripts ---
Source: "{#ScriptsDir}\generate-secrets.ps1"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "{#ScriptsDir}\init-postgresql.js"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "{#ScriptsDir}\setup-db.js"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "{#ScriptsDir}\run-migrations.ps1"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "{#ScriptsDir}\configure-firewall.ps1"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "{#ScriptsDir}\health-check.ps1"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "{#ScriptsDir}\pre-upgrade-backup.ps1"; Flags: dontcopy
Source: "{#ScriptsDir}\rollback.ps1"; DestDir: "{app}\tools"; Flags: ignoreversion
Source: "{#ScriptsDir}\protected-storage.ps1"; Flags: dontcopy
Source: "{#ScriptsDir}\secure-storage.ps1"; Flags: dontcopy
Source: "{#ScriptsDir}\protected-storage.ps1"; DestDir: "{app}\tools"; Flags: ignoreversion
Source: "{#ScriptsDir}\secure-storage.ps1"; DestDir: "{app}\tools"; Flags: ignoreversion
Source: "{#ScriptsDir}\enroll-ca-cert.ps1"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "{#ScriptsDir}\uninstall-services.ps1"; DestDir: "{app}\tools"; Flags: ignoreversion

; =============================================================================
; Directories — Data directories under {commonappdata}\SarayaLivestock
; =============================================================================
[Dirs]
Name: "{commonappdata}\SarayaLivestock"; Permissions: admins-full
Name: "{commonappdata}\SarayaLivestock\config"; Permissions: admins-full
Name: "{commonappdata}\SarayaLivestock\config\caddy"; Permissions: admins-full
Name: "{commonappdata}\SarayaLivestock\data\postgresql"; Permissions: admins-full
Name: "{commonappdata}\SarayaLivestock\data\caddy"; Permissions: admins-full
Name: "{commonappdata}\SarayaLivestock\backups"; Permissions: admins-full
Name: "{commonappdata}\SarayaLivestock\logs"; Permissions: admins-full
Name: "{commonappdata}\SarayaLivestock\logs\services"; Permissions: admins-full
Name: "{commonappdata}\SarayaLivestock\logs\postgresql"; Permissions: admins-full

; =============================================================================
; Icons
; =============================================================================
[Icons]
Name: "{group}\Saraya Livestock Server Tools"; Filename: "powershell.exe"; Parameters: "-NoExit -Command ""Write-Host 'Saraya Livestock Server Management Console' -ForegroundColor Green"""; WorkingDir: "{app}"
Name: "{group}\Uninstall Saraya Livestock Server"; Filename: "{uninstallexe}"

; =============================================================================
; Uninstall Run — cleanup services before file removal
; =============================================================================
[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\tools\uninstall-services.ps1"" -InstallDir ""{app}"""; Flags: runhidden waituntilterminated; RunOnceId: "UninstallServices"

; =============================================================================
; Pascal Script Code Section
; =============================================================================
[Code]

var
  AdminPage: TInputQueryWizardPage;
  OrgPage: TInputQueryWizardPage;
  ResultPage: TOutputMsgMemoWizardPage;
  InstallSuccess: Boolean;
  IsUpgrade: Boolean;
  IsRepair: Boolean;
  BackupDir: String;

// ---------------------------------------------------------------------------
// Utility: Run a PowerShell script and return the exit code
// ---------------------------------------------------------------------------
#include "preparation-progress.iss"

function RunPowerShell(const ScriptPath, Arguments: String; var ExitCode: Integer): Boolean;
var
  CmdLine: String;
begin
  if (ExtractFileName(ScriptPath) = 'secure-storage.ps1') or
     (ExtractFileName(ScriptPath) = 'pre-upgrade-backup.ps1') then
  begin
    Result := RunPreparationPowerShell(ScriptPath, Arguments, ExitCode);
    Exit;
  end;
  CmdLine := '-NoProfile -ExecutionPolicy Bypass -File "' + ScriptPath + '"';
  if Arguments <> '' then
    CmdLine := CmdLine + ' ' + Arguments;
  Result := Exec('powershell.exe', CmdLine, '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
end;

// ---------------------------------------------------------------------------
// Utility: Replace placeholder in a text file
// ---------------------------------------------------------------------------
procedure ReplaceInFile(const FileName, SearchStr, ReplaceStr: String);
var
  Lines: TArrayOfString;
  I: Integer;
begin
  if LoadStringsFromFile(FileName, Lines) then
  begin
    for I := 0 to GetArrayLength(Lines) - 1 do
    begin
      StringChangeEx(Lines[I], SearchStr, ReplaceStr, True);
    end;
    SaveStringsToFile(FileName, Lines, False);
  end;
end;

// ---------------------------------------------------------------------------
// Utility: Read one value from server.env
// ---------------------------------------------------------------------------
function ReadEnvValue(const FileName, Key: String): String;
var
  Lines: TArrayOfString;
  I: Integer;
  Prefix: String;
begin
  Result := '';
  Prefix := Key + '=';
  if LoadStringsFromFile(FileName, Lines) then
  begin
    for I := 0 to GetArrayLength(Lines) - 1 do
      if Pos(Prefix, Lines[I]) = 1 then
      begin
        Result := Copy(Lines[I], Length(Prefix) + 1, MaxInt);
        if (Length(Result) >= 2) and (Result[1] = '"') and
           (Result[Length(Result)] = '"') then
          Result := Copy(Result, 2, Length(Result) - 2);
        Exit;
      end;
  end;
end;

procedure SetResultText(const Value: String);
begin
  ResultPage.RichEditViewer.Lines.Text := Value;
end;

function ServiceExists(const ServiceName: String): Boolean;
var
  ExitCode: Integer;
begin
  Result := Exec(ExpandConstant('{sys}\sc.exe'), 'query "' + ServiceName + '"',
    '', SW_HIDE, ewWaitUntilTerminated, ExitCode) and (ExitCode = 0);
end;

function IsServiceStopped(const ServiceName: String): Boolean;
var
  ExitCode: Integer;
  CommandLine: String;
begin
  if not ServiceExists(ServiceName) then
  begin
    Result := True;
    Exit;
  end;

  CommandLine := '/C ""' + ExpandConstant('{sys}\sc.exe') + '" query "' +
    ServiceName + '" | "' + ExpandConstant('{sys}\findstr.exe') +
    '" /C:"STOPPED" >nul"';
  Result := Exec(ExpandConstant('{cmd}'), CommandLine, '', SW_HIDE,
    ewWaitUntilTerminated, ExitCode) and (ExitCode = 0);
end;

function StopServiceForFileUpdate(const ServiceName, WrapperPath: String): Boolean;
var
  ExitCode, I: Integer;
begin
  if not ServiceExists(ServiceName) then
  begin
    Result := True;
    Exit;
  end;

  if FileExists(WrapperPath) then
    Exec(WrapperPath, 'stop', '', SW_HIDE, ewWaitUntilTerminated, ExitCode);

  if not IsServiceStopped(ServiceName) then
    Exec(ExpandConstant('{sys}\sc.exe'), 'stop "' + ServiceName + '"',
      '', SW_HIDE, ewWaitUntilTerminated, ExitCode);

  for I := 1 to 120 do
  begin
    if IsServiceStopped(ServiceName) then
    begin
      Result := True;
      Exit;
    end;
    Sleep(250);
  end;
  Result := False;
end;

function RemoveExistingService(const ServiceName, WrapperPath, LegacyXmlPath: String): Boolean;
var
  ExitCode, I: Integer;
  LegacyWrapper: String;
begin
  if FileExists(WrapperPath) then
  begin
    Exec(WrapperPath, 'stop', '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
    Exec(WrapperPath, 'uninstall', '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
  end;

  LegacyWrapper := ExtractFileDir(WrapperPath) + '\WinSW.exe';
  if FileExists(LegacyWrapper) and FileExists(LegacyXmlPath) then
  begin
    Exec(LegacyWrapper, 'stop "' + LegacyXmlPath + '"', '', SW_HIDE,
      ewWaitUntilTerminated, ExitCode);
    Exec(LegacyWrapper, 'uninstall "' + LegacyXmlPath + '"', '', SW_HIDE,
      ewWaitUntilTerminated, ExitCode);
  end;

  if ServiceExists(ServiceName) then
  begin
    Exec(ExpandConstant('{sys}\sc.exe'), 'stop "' + ServiceName + '"',
      '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
    Exec(ExpandConstant('{sys}\sc.exe'), 'delete "' + ServiceName + '"',
      '', SW_HIDE, ewWaitUntilTerminated, ExitCode);
  end;

  for I := 1 to 40 do
  begin
    if not ServiceExists(ServiceName) then
    begin
      Result := True;
      Exit;
    end;
    Sleep(250);
  end;
  Result := False;
end;

function WaitForPostgreSQL(const InstallDir: String): Boolean;
var
  ExitCode, I: Integer;
begin
  Result := False;
  for I := 1 to 30 do
  begin
    if Exec(InstallDir + '\postgresql\bin\pg_isready.exe',
         '-h 127.0.0.1 -p 5435 -t 1', '', SW_HIDE,
         ewWaitUntilTerminated, ExitCode) and (ExitCode = 0) then
    begin
      Result := True;
      Exit;
    end;
    Sleep(1000);
  end;
end;

procedure ScrubInitialAdminPassword(const ServerEnvPath, InstallDir: String);
var
  SafeEnvPath: String;
  ExitCode: Integer;
begin
  SafeEnvPath := ServerEnvPath;
  StringChangeEx(SafeEnvPath, '\', '\\', True);
  Exec(InstallDir + '\node\node.exe',
    '-e "const fs = require(''fs''); const p = ''' + SafeEnvPath + '''; if (fs.existsSync(p)) fs.writeFileSync(p, fs.readFileSync(p, ''utf8'').replace(/^INITIAL_ADMIN_PASSWORD=.*$/m, ''INITIAL_ADMIN_PASSWORD=''));"',
    InstallDir + '\server', SW_HIDE, ewWaitUntilTerminated, ExitCode);
end;

// ---------------------------------------------------------------------------
// Prerequisites check
// ---------------------------------------------------------------------------
#include "install-mode.iss"

function InitializeSetup(): Boolean;
var
  WinVer: TWindowsVersion;
  InstallMarker: Cardinal;
  HasInnoRegistration, HasConfig, HasCluster, Completed: Boolean;
  InstallMode: Integer;
begin
  Result := True;
  GetWindowsVersionEx(WinVer);

  // Require 64-bit Windows 10 or later
  if not IsWin64 then
  begin
    SuppressibleMsgBox('هذا المثبّت يتطلب نظام تشغيل Windows 64-bit.' + #13#10 +
           'This installer requires 64-bit Windows.', mbError, MB_OK, IDOK);
    Result := False;
    Exit;
  end;

  // Distinguish an existing installation (upgrade/reinstall) from a fresh installation.
  HasConfig := FileExists(ExpandConstant(
    '{commonappdata}\SarayaLivestock\config\server.env'));
  HasCluster := FileExists(ExpandConstant(
    '{commonappdata}\SarayaLivestock\data\postgresql\PG_VERSION'));
  HasInnoRegistration := RegKeyExists(HKLM,
    'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{8A3F4E2B-C7D1-4E5F-9B8A-1D2E3F4A5B6C}_is1');

  InstallMarker := 0;
  Completed := RegQueryDWordValue(HKLM,
    'SOFTWARE\Saraya Solutions\Saraya Livestock', 'InstallComplete', InstallMarker)
    and (InstallMarker = 1);
  InstallMode := ClassifyInstallation(HasConfig, HasCluster, HasInnoRegistration, Completed);
  IsUpgrade := InstallMode = 1;
  IsRepair := InstallMode = 2;

  if IsUpgrade then
  begin
    if SuppressibleMsgBox('تم اكتشاف نسخة مثبتة مسبقاً من خادم السرايا للماشية.' + #13#10 +
              'سيتم تحديث ملفات الخادم مع الحفاظ التام على البيانات والإعدادات الحالية.' + #13#10#13#10 +
              'هل تريد المتابعة بعملية التحديث/الترقية؟' + #13#10 +
              'An existing installation was detected. Setup will upgrade the server while preserving your existing data and settings.' + #13#10 +
              'Do you want to proceed with the upgrade?',
              mbConfirmation, MB_YESNO, IDYES) = IDNO then
    begin
      Result := False;
      Exit;
    end;
  end;

  if IsRepair then
    SuppressibleMsgBox('تم اكتشاف محاولة تثبيت سابقة غير مكتملة.' + #13#10 +
           'سيتم إصلاح الخدمات ومتابعة التثبيت مع الحفاظ على الإعدادات وقاعدة البيانات الحالية.' + #13#10 +
           'An incomplete installation was detected. Setup will repair and resume it.',
           mbInformation, MB_OK, IDOK);
end;

procedure HardenDirectory(const DirectoryName: String; PublicRead: Boolean; NetworkServiceWrite: Boolean);
var
  Grants: String;
  ResultCode: Integer;
begin
  Grants := ' /grant:r *S-1-5-32-544:(OI)(CI)F *S-1-5-18:(OI)(CI)F';
  if NetworkServiceWrite then Grants := Grants + ' *S-1-5-20:(OI)(CI)F';
  Exec(ExpandConstant('{sys}\icacls.exe'), '"' + DirectoryName + '"' + Grants + ' /Q', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec(ExpandConstant('{sys}\icacls.exe'), '"' + DirectoryName + '" /inheritance:r /Q', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec(ExpandConstant('{sys}\icacls.exe'), '"' + DirectoryName + '" /remove:g *S-1-1-0 *S-1-5-11 *S-1-5-32-545 /Q', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  if PublicRead then
    Exec(ExpandConstant('{sys}\icacls.exe'), '"' + DirectoryName + '" /grant:r *S-1-5-32-545:(OI)(CI)RX /Q', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

// Stop installed services before [Files] attempts to replace their binaries.
// Stop installed services before [Files] attempts to replace their binaries.
// Exactly like SarayaManager server-setup.iss
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  // إغلاق أي نافذة مفتوحة لتطبيق العميل لتحديث ملفاته دون قفل
  Exec('taskkill.exe', '/F /IM SarayaLivestock.exe /T', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

  // إيقاف خدمات النظام مؤقتاً لتحديث ملفات السيرفر
  Exec('net.exe', 'stop SarayaCaddy', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec('net.exe', 'stop SarayaAPI', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec('net.exe', 'stop SarayaPostgreSQL', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

  Result := '';
end;

// ---------------------------------------------------------------------------
// Custom wizard pages
// ---------------------------------------------------------------------------
procedure InitializeWizard();
begin
  // Organization and Farm Name page
  OrgPage := CreateInputQueryPage(wpSelectDir,
    'إعدادات المؤسسة والمزرعة',
    'Organization & Farm Settings',
    'أدخل اسم المؤسسة والمزرعة لتهيئة النظام:');
  OrgPage.Add('اسم المؤسسة (Organization Name):', False);
  OrgPage.Add('اسم المزرعة (Farm Name):', False);
  OrgPage.Values[0] := '{#DefaultOrgName}';
  OrgPage.Values[1] := '{#DefaultFarmName}';

  // Admin credentials page (only for fresh install)
  AdminPage := CreateInputQueryPage(OrgPage.ID,
    'حساب المدير الأولي',
    'Initial Administrator Account',
    'أدخل بيانات حساب المسؤول الأول للنظام (كلمة المرور 12 حرفاً على الأقل):');
  AdminPage.Add('اسم المستخدم (Username):', False);
  AdminPage.Add('كلمة المرور (Password):', True);
  AdminPage.Add('تأكيد كلمة المرور (Confirm Password):', True);
  AdminPage.Values[0] := '{#DefaultAdminUser}';

  // Result page (shown at the end)
  ResultPage := CreateOutputMsgMemoPage(wpInfoAfter,
    'نتيجة التثبيت',
    'Installation Result',
    'تفاصيل عملية التثبيت:',
    '');
end;

// ---------------------------------------------------------------------------
// Skip admin page on upgrade (credentials already exist)
// ---------------------------------------------------------------------------
function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
  if (IsUpgrade or (IsRepair and FileExists(ExpandConstant(
       '{commonappdata}\SarayaLivestock\config\server.env')))) and
     ((PageID = AdminPage.ID) or (PageID = OrgPage.ID)) then
    Result := True;
end;

// ---------------------------------------------------------------------------
// Validate admin password
// ---------------------------------------------------------------------------
function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;

  if CurPageID = AdminPage.ID then
  begin
    // Validate username
    if Length(AdminPage.Values[0]) < 3 then
    begin
      MsgBox('اسم المستخدم يجب أن يكون 3 أحرف على الأقل.' + #13#10 +
             'Username must be at least 3 characters.', mbError, MB_OK);
      Result := False;
      Exit;
    end;

    // Validate password length (minimum 12 characters as required by provision-admin)
    if Length(AdminPage.Values[1]) < 12 then
    begin
      MsgBox('كلمة المرور يجب أن تكون 12 حرفاً على الأقل للحماية.' + #13#10 +
             'Password must be at least 12 characters.', mbError, MB_OK);
      Result := False;
      Exit;
    end;

    // Confirm password match
    if AdminPage.Values[1] <> AdminPage.Values[2] then
    begin
      MsgBox('كلمتا المرور غير متطابقتين.' + #13#10 +
             'Passwords do not match.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
  end;
end;

// ---------------------------------------------------------------------------
// Main post-install orchestration
// ---------------------------------------------------------------------------
procedure CurStepChanged(CurStep: TSetupStep);
var
  InstallDir, DataDir, ConfigDir, TmpDir: String;
  ServerEnvPath, CaddyfilePath, ClientJsonPath: String;
  DbPassword, SafeEnvPath, SafeProvisionPath: String;
  PgWrapper, ApiWrapper, CaddyWrapper: String;
  ExitCode: Integer;
  ResultLog: String;
  DetailMsg: AnsiString;
begin
  if CurStep <> ssPostInstall then Exit;

  InstallSuccess := False;
  InstallDir := ExpandConstant('{app}');
  DataDir := ExpandConstant('{commonappdata}\SarayaLivestock');
  TmpDir := ExpandConstant('{tmp}');
  ConfigDir := DataDir + '\config';
  if not DirExists(ConfigDir) then ForceDirectories(ConfigDir);
  if not DirExists(DataDir + '\data\postgresql') then ForceDirectories(DataDir + '\data\postgresql');
  if not DirExists(DataDir + '\logs\postgresql') then ForceDirectories(DataDir + '\logs\postgresql');
  if not DirExists(DataDir + '\logs\services') then ForceDirectories(DataDir + '\logs\services');
  PgWrapper := InstallDir + '\services\SarayaPostgreSQL.exe';
  ApiWrapper := InstallDir + '\services\SarayaAPI.exe';
  CaddyWrapper := InstallDir + '\services\SarayaCaddy.exe';
  ResultLog := '';

  // STEP 0: Process WinSW XML placeholders. The service XML files are replaced
  // by [Files] before this callback, so they must be made runnable before an
  // upgrade starts PostgreSQL for the verified pre-migration backup.
  WizardForm.StatusLabel.Caption := 'جاري تهيئة تعريفات الخدمات...';
  ReplaceInFile(InstallDir + '\services\SarayaPostgreSQL.xml', '{{INSTALL_DIR}}', InstallDir);
  ReplaceInFile(InstallDir + '\services\SarayaPostgreSQL.xml', '{{DATA_DIR}}', DataDir);
  ReplaceInFile(InstallDir + '\services\SarayaAPI.xml', '{{INSTALL_DIR}}', InstallDir);
  ReplaceInFile(InstallDir + '\services\SarayaAPI.xml', '{{DATA_DIR}}', DataDir);
  ReplaceInFile(InstallDir + '\services\SarayaCaddy.xml', '{{INSTALL_DIR}}', InstallDir);
  ReplaceInFile(InstallDir + '\services\SarayaCaddy.xml', '{{DATA_DIR}}', DataDir);
  ReplaceInFile(InstallDir + '\services\SarayaCaddy.xml', '{{HOSTNAME}}', '{#DefaultHostname}');
  ResultLog := ResultLog + '• تهيئة تعريفات الخدمات: تمت' + #13#10;

  // Complete snapshot verified before replacing files in PrepareToInstall.

  // STEP 2: Create server.env and generate cryptographically secure secrets
  WizardForm.StatusLabel.Caption := 'جاري إنشاء ملف الإعدادات...';
  ServerEnvPath := ConfigDir + '\server.env';
  if not IsUpgrade then
  begin
    if not FileExists(ServerEnvPath) then
    begin
      FileCopy(TmpDir + '\server.env.template', ServerEnvPath, False);
      ReplaceInFile(ServerEnvPath, '{{DB_NAME}}', '{#DefaultDbName}');
      ReplaceInFile(ServerEnvPath, '{{HOSTNAME}}', '{#DefaultClientAddress}');
      ReplaceInFile(ServerEnvPath, '{{INITIAL_ORG_NAME}}', OrgPage.Values[0]);
      ReplaceInFile(ServerEnvPath, '{{INITIAL_FARM_NAME}}', OrgPage.Values[1]);
      ReplaceInFile(ServerEnvPath, '{{INITIAL_ADMIN_USERNAME}}', AdminPage.Values[0]);
      ReplaceInFile(ServerEnvPath, '{{INITIAL_ADMIN_PASSWORD}}', AdminPage.Values[1]);
      ReplaceInFile(ServerEnvPath, '{{DATA_DIR}}', DataDir);
    end;

    // A failed fresh installation may leave an otherwise valid server.env with
    // secret placeholders. Running the generator during repair is idempotent:
    // it replaces placeholders only and preserves secrets already generated.
    WizardForm.StatusLabel.Caption := 'جاري توليد المفاتيح والكلمات السرية...';
    if not RunPowerShell(TmpDir + '\generate-secrets.ps1',
         '-EnvFilePath "' + ServerEnvPath + '"', ExitCode) or (ExitCode <> 0) then
    begin
      SuppressibleMsgBox('فشل توليد مفاتيح التشفير الآمنة (Exit Code: ' + IntToStr(ExitCode) + ')', mbError, MB_OK, IDOK);
      ResultLog := ResultLog + 'X فشل توليد المفاتيح التشفيرية' + #13#10;
      SetResultText(ResultLog);
      Exit;
    end;
    DbPassword := ReadEnvValue(ServerEnvPath, 'DB_PASSWORD');
    if (DbPassword = '') or (Pos('{{', DbPassword) > 0) then
    begin
      SuppressibleMsgBox('تعذر قراءة كلمة مرور قاعدة البيانات من ملف الإعدادات.', mbError, MB_OK, IDOK);
      ResultLog := ResultLog + 'X ملف الإعدادات لا يحتوي DB_PASSWORD' + #13#10;
      SetResultText(ResultLog);
      Exit;
    end;
    ResultLog := ResultLog + '• المفاتيح التشفيرية: تم التوليد الآمن بنجاح' + #13#10;
    if IsRepair then
      ResultLog := ResultLog + '• ملف الإعدادات (server.env): تم إصلاح القيم الناقصة' + #13#10
    else
      ResultLog := ResultLog + '• ملف الإعدادات (server.env): تم الإنشاء' + #13#10;
  end
  else
  begin
    DbPassword := ReadEnvValue(ServerEnvPath, 'DB_PASSWORD');
    ReplaceInFile(ServerEnvPath, 'https://saraya.local:8443', 'https://saraya.local:18443');
    ReplaceInFile(ServerEnvPath, 'CORS_ORIGINS=https://saraya.local,null',
      'CORS_ORIGINS=https://saraya.local:18443,null');
    ResultLog := ResultLog + '• ملف الإعدادات: تم الحفاظ عليه (ترقية)' + #13#10;
  end;

  // Explicitly harden permissions on server.env across all installation modes
  Exec(ExpandConstant('{sys}\icacls.exe'),
    '"' + ServerEnvPath + '" /inheritance:r /grant:r *S-1-5-32-544:F /grant:r *S-1-5-18:F /grant:r *S-1-5-20:R /C /Q',
    '', SW_HIDE, ewWaitUntilTerminated, ExitCode);

  // STEP 4: Create Caddyfile
  CaddyfilePath := ConfigDir + '\Caddyfile';
  if (not (IsUpgrade or IsRepair)) or (not FileExists(CaddyfilePath)) then
    FileCopy(TmpDir + '\Caddyfile', CaddyfilePath, False)
  else
  begin
    ReplaceInFile(CaddyfilePath, 'http_port 8080', 'http_port 18080');
    ReplaceInFile(CaddyfilePath, 'https_port 8443', 'https_port 18443');
    ReplaceInFile(CaddyfilePath, '}:8443 {', '}:18443 {');
  end;

  // STEP 5: Create client.json
  ClientJsonPath := ConfigDir + '\client.json';
  if (not (IsUpgrade or IsRepair)) or (not FileExists(ClientJsonPath)) then
  begin
    FileCopy(TmpDir + '\client.json.template', ClientJsonPath, False);
    ReplaceInFile(ClientJsonPath, '{{HOSTNAME}}', '{#DefaultClientAddress}');
  end
  else
  begin
    ReplaceInFile(ClientJsonPath, 'https://saraya.local:8443/api/v1',
      'https://saraya.local:18443/api/v1');
    ReplaceInFile(ClientJsonPath, 'https://saraya.local/api/v1',
      'https://saraya.local:18443/api/v1');
  end;

  // STEP 6: initdb ONLY (fresh install)
  if not IsUpgrade then
  begin
    WizardForm.StatusLabel.Caption := 'جاري تهيئة عنقود PostgreSQL (Port 5435)...';
    if not Exec(InstallDir + '\node\node.exe',
         '"' + TmpDir + '\init-postgresql.js" --install-dir "' + InstallDir + '" --data-dir "' + DataDir + '" --db-password "' + DbPassword + '" --template-dir "' + TmpDir + '"',
         '', SW_HIDE, ewWaitUntilTerminated, ExitCode) or (ExitCode <> 0) then
    begin
      SuppressibleMsgBox('فشل في تهيئة عنقود قاعدة البيانات PostgreSQL (Exit Code: ' + IntToStr(ExitCode) + ')', mbError, MB_OK, IDOK);
      ResultLog := ResultLog + 'X فشل تهيئة عنقود PostgreSQL (Exit Code: ' + IntToStr(ExitCode) + ')' + #13#10;
      SetResultText(ResultLog);
      Exit;
    end;
    ResultLog := ResultLog + '• تهيئة عنقود PostgreSQL (Port 5435): تمت بنجاح' + #13#10;
  end
  else
    ResultLog := ResultLog + '• عنقود PostgreSQL: موجود مسبقاً' + #13#10;

  // STEP 7: Register + start PostgreSQL service, then create database
  WizardForm.StatusLabel.Caption := 'جاري تسجيل وتشغيل خدمة PostgreSQL...';

  HardenDirectory(DataDir, False, True);
  HardenDirectory(DataDir + '\config', False, True);
  HardenDirectory(DataDir + '\backups', False, True);
  HardenDirectory(DataDir + '\data\postgresql', False, True);
  HardenDirectory(DataDir + '\data\caddy', False, True);
  HardenDirectory(DataDir + '\logs', True, True);

  // Remove a stale registration and wait until SCM confirms deletion.
  if not RemoveExistingService('SarayaPostgreSQL', PgWrapper,
       InstallDir + '\services\SarayaPostgreSQL.xml') then
  begin
    SuppressibleMsgBox('تعذر إزالة تسجيل PostgreSQL القديم. أعد تشغيل Windows ثم حاول مجدداً.', mbError, MB_OK, IDOK);
    ResultLog := ResultLog + 'X تعذر إزالة تسجيل خدمة PostgreSQL القديم' + #13#10;
    SetResultText(ResultLog);
    Exit;
  end;

  if not Exec(PgWrapper, 'install', '', SW_HIDE, ewWaitUntilTerminated, ExitCode) or
     (ExitCode <> 0) then
  begin
    SuppressibleMsgBox('تعذر تسجيل خدمة PostgreSQL (Exit Code: ' + IntToStr(ExitCode) + '). راجع ' +
      DataDir + '\logs\services', mbError, MB_OK, IDOK);
    ResultLog := ResultLog + 'X تعذر تسجيل خدمة PostgreSQL (Exit Code: ' + IntToStr(ExitCode) + ')' + #13#10;
    SetResultText(ResultLog);
    Exit;
  end;

  if not Exec(PgWrapper, 'start', '', SW_HIDE, ewWaitUntilTerminated, ExitCode) or
     (ExitCode <> 0) or (not WaitForPostgreSQL(InstallDir)) then
  begin
    SuppressibleMsgBox('تعذر تشغيل PostgreSQL أو لم يصبح جاهزاً على المنفذ 5435. راجع ' +
      DataDir + '\logs\services\SarayaPostgreSQL.err.log', mbError, MB_OK, IDOK);
    ResultLog := ResultLog + 'X خدمة PostgreSQL لم تصبح جاهزة على المنفذ 5435' + #13#10;
    SetResultText(ResultLog);
    Exit;
  end;
  ResultLog := ResultLog + '• خدمة PostgreSQL: تم التسجيل والتشغيل بنجاح' + #13#10;

  // Create DB user and database on a fresh installation only.
  if not IsUpgrade then
  begin
    WizardForm.StatusLabel.Caption := 'جاري إنشاء مستخدم وقاعدة البيانات...';
    if not Exec(InstallDir + '\node\node.exe',
         '"' + TmpDir + '\setup-db.js" --install-dir "' + InstallDir + '" --data-dir "' + DataDir + '" --db-name "{#DefaultDbName}" --db-user "{#DefaultDbUser}" --db-password "' + DbPassword + '"',
         '', SW_HIDE, ewWaitUntilTerminated, ExitCode) or (ExitCode <> 0) then
    begin
      DetailMsg := '';
      if LoadStringFromFile(ExpandConstant('{tmp}\database-setup-error.log'), DetailMsg) or
         LoadStringFromFile(ExpandConstant('{localappdata}\Temp\database-setup-error.log'), DetailMsg) then
        SuppressibleMsgBox('فشل في إنشاء قاعدة البيانات والمستخدم: ' + #13#10 + Trim(String(DetailMsg)) + #13#10#13#10 + 'راجع السجل في ' + DataDir + '\logs\database-setup.log', mbError, MB_OK, IDOK)
      else
        SuppressibleMsgBox('فشل في إنشاء قاعدة البيانات والمستخدم (Exit Code: ' + IntToStr(ExitCode) + '). راجع السجل في ' + DataDir + '\logs\database-setup.log', mbError, MB_OK, IDOK);
      ResultLog := ResultLog + 'X فشل إعداد قاعدة البيانات' + #13#10;
      SetResultText(ResultLog);
      Exit;
    end;
    ResultLog := ResultLog + '• إنشاء قاعدة البيانات والمستخدم: تم بنجاح' + #13#10;
  end;

  // STEP 8: Prisma migrations
  WizardForm.StatusLabel.Caption := 'جاري تطبيق ترحيلات قاعدة البيانات (Prisma Migrations)...';
  if RunPowerShell(TmpDir + '\run-migrations.ps1',
       '-InstallDir "' + InstallDir + '" -DataDir "' + DataDir + '" -DbName "{#DefaultDbName}"',
       ExitCode) and (ExitCode = 0) then
    ResultLog := ResultLog + '• ترحيلات قاعدة البيانات: تمت بنجاح' + #13#10
  else
  begin
    DetailMsg := '';
    if LoadStringFromFile(DataDir + '\logs\saraya-migration-error.log', DetailMsg) or
       LoadStringFromFile(TmpDir + '\saraya-migration-error.log', DetailMsg) or
       LoadStringFromFile(ExpandConstant('{tmp}\saraya-migration-error.log'), DetailMsg) or
       LoadStringFromFile(ExpandConstant('{localappdata}\Temp\saraya-migration-error.log'), DetailMsg) then
      SuppressibleMsgBox('فشل تطبيق ترحيلات قاعدة البيانات: ' + #13#10 + Trim(String(DetailMsg)) + #13#10#13#10 +
        'راجع السجل في: ' + DataDir + '\logs\migration.log', mbError, MB_OK, IDOK)
    else
      SuppressibleMsgBox('فشل تطبيق ترحيلات قاعدة البيانات (Exit Code: ' + IntToStr(ExitCode) + ').' + #13#10#13#10 +
        'راجع السجل في: ' + DataDir + '\logs\migration.log', mbError, MB_OK, IDOK);
    ResultLog := ResultLog + 'X فشل تطبيق ترحيلات قاعدة البيانات (Exit Code: ' + IntToStr(ExitCode) + ')' + #13#10;
    SetResultText(ResultLog);
    Exit;
  end;

  // STEP 9: Admin account (fresh only)
  if not IsUpgrade then
  begin
    WizardForm.StatusLabel.Caption := 'جاري إنشاء حساب المدير الأولي...';
    SafeEnvPath := ServerEnvPath;
    StringChangeEx(SafeEnvPath, '\', '\\', True);
    SafeProvisionPath := InstallDir + '\server\dist\cli\provision-admin.js';
    StringChangeEx(SafeProvisionPath, '\', '\\', True);
    if Exec(InstallDir + '\node\node.exe',
         '-e "require(''dotenv'').config({path:''' + SafeEnvPath + '''});require(''' + SafeProvisionPath + ''')"',
         InstallDir + '\server', SW_HIDE, ewWaitUntilTerminated, ExitCode) and (ExitCode = 0) then
      ResultLog := ResultLog + '• حساب المدير الأولي: تم الإنشاء بنجاح' + #13#10
    else
      ResultLog := ResultLog + '! تعذر إنشاء حساب المدير (يمكن إعداده لاحقاً)' + #13#10;
    // Strip initial admin password from server.env post-provisioning
  end;

  // Unconditionally scrub INITIAL_ADMIN_PASSWORD across all modes
  ScrubInitialAdminPassword(ServerEnvPath, InstallDir);

  // STEP 10: API service
  WizardForm.StatusLabel.Caption := 'جاري تسجيل وتشغيل خدمة API...';
  if not RemoveExistingService('SarayaAPI', ApiWrapper,
       InstallDir + '\services\SarayaAPI.xml') then
  begin
    ResultLog := ResultLog + 'X تعذر إزالة تسجيل خدمة API القديم' + #13#10;
    SetResultText(ResultLog);
    Exit;
  end;
  if Exec(ApiWrapper, 'install', '', SW_HIDE, ewWaitUntilTerminated, ExitCode) and
     (ExitCode = 0) then
  begin
    if not Exec(ApiWrapper, 'start', '', SW_HIDE, ewWaitUntilTerminated, ExitCode) or
       (ExitCode <> 0) then
    begin
      ResultLog := ResultLog + 'X فشل تشغيل خدمة API (Exit Code: ' + IntToStr(ExitCode) + ')' + #13#10;
      SetResultText(ResultLog);
      Exit;
    end;
    Sleep(5000);
    ResultLog := ResultLog + '• خدمة API: تم التسجيل والتشغيل بنجاح' + #13#10;
  end
  else
  begin
    ResultLog := ResultLog + 'X فشل تسجيل خدمة API (Exit Code: ' + IntToStr(ExitCode) + ')' + #13#10;
    SetResultText(ResultLog);
    Exit;
  end;

  // STEP 11: Caddy service
  WizardForm.StatusLabel.Caption := 'جاري تسجيل وتشغيل خدمة Caddy Web/Proxy...';
  if not RemoveExistingService('SarayaCaddy', CaddyWrapper,
       InstallDir + '\services\SarayaCaddy.xml') then
  begin
    ResultLog := ResultLog + 'X تعذر إزالة تسجيل خدمة Caddy القديم' + #13#10;
    SetResultText(ResultLog);
    Exit;
  end;
  if Exec(CaddyWrapper, 'install', '', SW_HIDE, ewWaitUntilTerminated, ExitCode) and
     (ExitCode = 0) then
  begin
    if not Exec(CaddyWrapper, 'start', '', SW_HIDE, ewWaitUntilTerminated, ExitCode) or
       (ExitCode <> 0) then
    begin
      ResultLog := ResultLog + 'X فشل تشغيل خدمة Caddy (Exit Code: ' + IntToStr(ExitCode) + ')' + #13#10;
      SetResultText(ResultLog);
      Exit;
    end;
    Sleep(3000);
    ResultLog := ResultLog + '• خدمة Caddy Web Server: تم التسجيل والتشغيل بنجاح' + #13#10;
  end
  else
  begin
    ResultLog := ResultLog + 'X فشل تسجيل خدمة Caddy (Exit Code: ' + IntToStr(ExitCode) + ')' + #13#10;
    SetResultText(ResultLog);
    Exit;
  end;

  // STEP 12: Firewall
  WizardForm.StatusLabel.Caption := 'جاري إعداد جدار حماية Windows...';
  if RunPowerShell(TmpDir + '\configure-firewall.ps1', '', ExitCode) and (ExitCode = 0) then
    ResultLog := ResultLog + '• جدار الحماية: تم تكوينه بنجاح (Port {#DefaultHttpPort}/{#DefaultHttpsPort})' + #13#10
  else
    ResultLog := ResultLog + '! جدار الحماية: (يمكن تكوينه يدوياً)' + #13#10;

  // STEP 12b: Final Hardening of Storage and Secrets
  WizardForm.StatusLabel.Caption := 'جاري تشديد أذونات تخزين البيانات والأسرار...';
  
  HardenDirectory(DataDir, False, True);
  HardenDirectory(DataDir + '\config', False, True);
  HardenDirectory(DataDir + '\backups', False, True);
  HardenDirectory(DataDir + '\data\postgresql', False, True);
  HardenDirectory(DataDir + '\data\caddy', False, True);
  HardenDirectory(DataDir + '\logs', True, True);
  
  ResultLog := ResultLog + '✓ تشديد أذونات البيانات والنسخ الاحتياطية: تم بنجاح' + #13#10;

  // STEP 13: Health check
  WizardForm.StatusLabel.Caption := 'جاري التحقق من جاهزية النظام...';
  if RunPowerShell(TmpDir + '\health-check.ps1', '-Hostname "{#DefaultHostname}" -HttpsPort {#DefaultHttpsPort} -TimeoutSeconds 60', ExitCode) and (ExitCode = 0) then
    ResultLog := ResultLog + '• فحص الجاهزية: النظام يعمل بكفاءة وجاهز' + #13#10
  else
  begin
    ResultLog := ResultLog + 'X فشل فحص الجاهزية النهائي (Exit Code: ' + IntToStr(ExitCode) + ')' + #13#10;
    SetResultText(ResultLog);
    SuppressibleMsgBox('لم ينجح فحص الجاهزية النهائي. راجع سجلات الخدمات في ' +
      DataDir + '\logs\services', mbError, MB_OK, IDOK);
    Exit;
  end;
  InstallSuccess := True;
  RegWriteDWordValue(HKLM, 'SOFTWARE\Saraya Solutions\Saraya Livestock',
    'InstallComplete', 1);

  // STEP 14: CA cert
  RunPowerShell(TmpDir + '\enroll-ca-cert.ps1', '-DataDir "' + DataDir + '"', ExitCode);

  // Final summary
  ResultLog := ResultLog + #13#10 + '===========================================' + #13#10;
  if InstallSuccess then
  begin
    ResultLog := ResultLog + 'تم تثبيت خادم السرايا لإدارة الماشية بنجاح!' + #13#10#13#10;
    ResultLog := ResultLog + 'الخدمات المشغلة:' + #13#10;
    ResultLog := ResultLog + '  • قاعدة البيانات PostgreSQL (المنفذ: 5435)' + #13#10;
    ResultLog := ResultLog + '  • خادم التطبيقات والواجهات API Server' + #13#10;
    ResultLog := ResultLog + '  • خادم الويب والتشفير Caddy Web Server' + #13#10#13#10;
    ResultLog := ResultLog + 'رابط الوصول: https://{#DefaultClientAddress}' + #13#10;
    if not (IsUpgrade or IsRepair) then
    begin
      ResultLog := ResultLog + 'اسم المستخدم: ' + AdminPage.Values[0] + #13#10;
      ResultLog := ResultLog + 'كلمة المرور: (التي أدخلتها أثناء التثبيت)' + #13#10;
    end;
    ResultLog := ResultLog + 'ملف الإعدادات: ' + ConfigDir + '\server.env' + #13#10;
  end
  else
    ResultLog := ResultLog + 'فشل التثبيت. يرجى مراجعة التفاصيل أعلاه.' + #13#10;

  SetResultText(ResultLog);
end;

// ---------------------------------------------------------------------------
// Uninstall confirmation
// ---------------------------------------------------------------------------
function InitializeUninstall(): Boolean;
begin
  Result := True;
  if SuppressibleMsgBox('سيتم إزالة خادم السرايا للماشية وجميع الخدمات المسجّلة.' + #13#10 +
            'بيانات العملاء والنسخ الاحتياطية وشهادات CA ستبقى محفوظة في:' + #13#10 +
            ExpandConstant('{commonappdata}\SarayaLivestock') + #13#10#13#10 +
            'لحذف البيانات نهائياً، قم بإزالة هذا المجلد يدوياً بعد إلغاء التثبيت.' + #13#10#13#10 +
            'هل تريد المتابعة؟',
            mbConfirmation, MB_YESNO, IDYES) = IDNO then
    Result := False;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
    RegDeleteKeyIncludingSubkeys(HKLM,
      'SOFTWARE\Saraya Solutions\Saraya Livestock');
end;
