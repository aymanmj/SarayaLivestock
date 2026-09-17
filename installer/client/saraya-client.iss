; =============================================================================
; Saraya Livestock Client Installer — Inno Setup 6 Script
; مثبت واجهة العميل لمنظومة السرايا لإدارة مزارع الماشية والألبان والتسمين
; =============================================================================
; Build:  iscc.exe "installer\client\saraya-client.iss"
; Output: dist-installer\SarayaLivestock-Client-<ver>-x64-Setup.exe
; =============================================================================

#define MyAppName          "Saraya Livestock Client"
#define MyAppNameAr        "السرايا لإدارة الماشية والألبان — واجهة العميل"
#define MyAppVersion       "1.0.0"
#define MyAppPublisher     "Saraya Solutions"
#define MyAppURL           "https://saraya-livestock.com"
#define MyAppExeName       "SarayaLivestock.exe"

#define DefaultHostname    "saraya.local:18443"
#define DefaultHttpsPort   "18443"
#define DefaultStationId   "UNCONFIGURED"
#define DefaultFarmBranch  "المزرعة الرئيسية"

; Source directories (relative to this .iss file)
#define ClientDistDir      "..\..\apps\desktop\dist-electron\win-unpacked"
#define ScriptsDir         "scripts"

[Setup]
AppId={{C5A8D4F1-B9E2-4A7C-8D3F-6E5A1B2C3D4E}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppNameAr} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
DefaultDirName={autopf}\Saraya Livestock Client
DefaultGroupName=Saraya Livestock
DisableProgramGroupPage=no
LicenseFile=..\..\LICENSE
OutputDir=..\..\dist-installer
OutputBaseFilename=SarayaLivestock-Client-{#MyAppVersion}-x64-Setup
Compression=lzma2/max
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
SetupLogging=yes
UninstallDisplayName={#MyAppNameAr}
WizardStyle=modern
WizardSizePercent=120
DisableWelcomePage=no
DisableDirPage=no
ShowLanguageDialog=no
CloseApplications=yes
RestartApplications=no
UsePreviousAppDir=yes

; Minimum Windows 10 (build 17763 = 1809)
MinVersion=10.0.17763

[Languages]
Name: "arabic"; MessagesFile: "compiler:Languages\Arabic.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Messages]
arabic.BeveledLabel=منظومة السرايا لإدارة مزارع الماشية والألبان والتسمين — واجهة العميل

; =============================================================================
; Files Section
; =============================================================================
[Files]
; --- Electron application (complete win-unpacked bundle) ---
Source: "{#ClientDistDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

; --- Configuration utility (kept in {app}\tools for post-install reconfiguration) ---
Source: "{#ScriptsDir}\configure-client.ps1"; DestDir: "{app}\tools"; Flags: ignoreversion

; --- Config template (to temp, processed during install) ---
Source: "config\client.json.template"; DestDir: "{tmp}"; Flags: deleteafterinstall

; =============================================================================
; Directories — Shared data under {commonappdata}\SarayaLivestock
; =============================================================================
[Dirs]
; Only create if we have admin; otherwise the [Code] section handles user-level paths.
; uninsneveruninstall: keep data even if client is removed (server may still need it).
Name: "{commonappdata}\SarayaLivestock"; Flags: uninsneveruninstall; Check: IsAdminInstallMode

; =============================================================================
; Icons — Shortcuts
; =============================================================================
[Icons]
; Desktop shortcut
Name: "{autodesktop}\{#MyAppNameAr}"; Filename: "{app}\{#MyAppExeName}"; \
  Comment: "تشغيل منظومة السرايا لإدارة مزارع الماشية والألبان والتسمين"

; Start menu group
Name: "{group}\{#MyAppNameAr}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\إعادة تهيئة اتصال المحطة (Reconfigure)"; Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\tools\configure-client.ps1"" -TestConnection"; \
  WorkingDir: "{app}\tools"; Comment: "تغيير عنوان الخادم أو إعدادات المحطة"
Name: "{group}\إلغاء تثبيت واجهة العميل"; Filename: "{uninstallexe}"

; =============================================================================
; Run — Post-install launch
; =============================================================================
[Run]
Filename: "{app}\{#MyAppExeName}"; \
  Description: "تشغيل منظومة السرايا لإدارة الماشية الآن (Launch Application)"; \
  Flags: nowait postinstall skipifsilent

; =============================================================================
; Pascal Script Code Section
; =============================================================================
[Code]

var
  ServerPage: TInputQueryWizardPage;
  ResultPage: TOutputMsgMemoWizardPage;
  InstallSuccess: Boolean;
  IsUpgrade: Boolean;
  ExistingHostname: String;
  ExistingStationId: String;
  ExistingFarmBranch: String;

// ---------------------------------------------------------------------------
// JSON helpers — read a simple "key": "value" from a flat JSON file
// ---------------------------------------------------------------------------
function ReadJsonStringValue(const FileName, Key: String): String;
var
  Lines: TArrayOfString;
  I, P, Q: Integer;
  Needle, Line: String;
begin
  Result := '';
  Needle := '"' + Key + '"';
  if LoadStringsFromFile(FileName, Lines) then
  begin
    for I := 0 to GetArrayLength(Lines) - 1 do
    begin
      Line := Trim(Lines[I]);
      P := Pos(Needle, Line);
      if P > 0 then
      begin
        // Find the value after the colon
        P := Pos(':', Line);
        if P > 0 then
        begin
          Line := Trim(Copy(Line, P + 1, MaxInt));
          // Remove surrounding quotes and trailing comma
          if (Length(Line) > 0) and (Line[Length(Line)] = ',') then
            Line := Copy(Line, 1, Length(Line) - 1);
          Line := Trim(Line);
          if (Length(Line) >= 2) and (Line[1] = '"') and (Line[Length(Line)] = '"') then
            Result := Copy(Line, 2, Length(Line) - 2);
        end;
        Exit;
      end;
    end;
  end;
end;

// ---------------------------------------------------------------------------
// Determine the best config path based on current privileges
// ---------------------------------------------------------------------------
function GetPrimaryConfigPath: String;
begin
  if IsAdminInstallMode then
    Result := ExpandConstant('{commonappdata}\SarayaLivestock\client.json')
  else
    Result := ExpandConstant('{userappdata}\saraya-livestock-desktop\client.json');
end;

function GetFallbackConfigPath: String;
begin
  Result := ExpandConstant('{userappdata}\saraya-livestock-desktop\client.json');
end;

// ---------------------------------------------------------------------------
// Load existing configuration (for upgrade detection)
// ---------------------------------------------------------------------------
procedure LoadExistingConfig;
var
  PdPath, UaPath: String;
  FoundPath: String;
begin
  ExistingHostname := '';
  ExistingStationId := '';
  ExistingFarmBranch := '';
  FoundPath := '';

  PdPath := ExpandConstant('{commonappdata}\SarayaLivestock\client.json');
  UaPath := ExpandConstant('{userappdata}\saraya-livestock-desktop\client.json');

  if FileExists(PdPath) then
    FoundPath := PdPath
  else if FileExists(UaPath) then
    FoundPath := UaPath;

  if FoundPath <> '' then
  begin
    ExistingHostname := ReadJsonStringValue(FoundPath, 'apiBaseUrl');
    // Extract hostname from URL: https://HOSTNAME/api/v1
    if Pos('https://', ExistingHostname) = 1 then
    begin
      ExistingHostname := Copy(ExistingHostname, 9, MaxInt);
      if Pos('/', ExistingHostname) > 0 then
        ExistingHostname := Copy(ExistingHostname, 1, Pos('/', ExistingHostname) - 1);

      // Migrate configurations created before Livestock was moved away from
      // Saraya Manager's shared 443 port.
      if (Length(ExistingHostname) >= 5) and
         (CompareText(Copy(ExistingHostname, Length(ExistingHostname) - 4, 5), ':8443') = 0) then
        ExistingHostname := Copy(ExistingHostname, 1, Length(ExistingHostname) - 5) +
          ':{#DefaultHttpsPort}'
      else if Pos(':', ExistingHostname) = 0 then
        ExistingHostname := ExistingHostname + ':{#DefaultHttpsPort}';
    end
    else
      ExistingHostname := '';

    ExistingStationId := ReadJsonStringValue(FoundPath, 'stationId');
    ExistingFarmBranch := ReadJsonStringValue(FoundPath, 'farmBranch');
  end;
end;

// ---------------------------------------------------------------------------
// Write client.json to a given path
// ---------------------------------------------------------------------------
function WriteClientJson(const FilePath, Hostname, StationId, FarmBranch: String): Boolean;
var
  Lines: TArrayOfString;
  Dir: String;
begin
  Result := False;
  Dir := ExtractFileDir(FilePath);
  if not DirExists(Dir) then
    if not ForceDirectories(Dir) then
      Exit;

  SetArrayLength(Lines, 5);
  Lines[0] := '{';
  Lines[1] := '  "apiBaseUrl": "https://' + Hostname + '/api/v1",';
  Lines[2] := '  "stationId": "' + StationId + '",';
  Lines[3] := '  "farmBranch": "' + FarmBranch + '"';
  Lines[4] := '}';
  Result := SaveStringsToFile(FilePath, Lines, False);
end;

procedure SetResultText(const Value: String);
begin
  ResultPage.RichEditViewer.Lines.Text := Value;
end;

// ---------------------------------------------------------------------------
// Prerequisites check and upgrade detection
// ---------------------------------------------------------------------------
function InitializeSetup(): Boolean;
var
  WinVer: TWindowsVersion;
begin
  Result := True;
  GetWindowsVersionEx(WinVer);

  if not IsWin64 then
  begin
    SuppressibleMsgBox(
      'هذا المثبّت يتطلب نظام تشغيل Windows 64-bit.' + #13#10 +
      'This installer requires 64-bit Windows.',
      mbError, MB_OK, IDOK);
    Result := False;
    Exit;
  end;

  // Detect upgrade: check for existing client.json
  LoadExistingConfig;
  IsUpgrade := (ExistingHostname <> '') and (ExistingHostname <> 'UNCONFIGURED');

  if IsUpgrade then
  begin
    if SuppressibleMsgBox(
         'تم اكتشاف نسخة مثبتة مسبقاً من واجهة العميل.' + #13#10 +
         'سيتم تحديث التطبيق مع الحفاظ على إعدادات الاتصال الحالية.' + #13#10#13#10 +
         'هل تريد المتابعة بعملية الترقية؟' + #13#10 +
         'An existing installation was detected. Your connection settings will be preserved.' + #13#10 +
         'Do you want to proceed?',
         mbConfirmation, MB_YESNO, IDYES) = IDNO then
    begin
      Result := False;
      Exit;
    end;
  end;
end;

// ---------------------------------------------------------------------------
// Kill the running application before file replacement
// ---------------------------------------------------------------------------
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Result := '';
  // Close the desktop client if running, to unlock application files
  Exec('taskkill.exe', '/F /IM {#MyAppExeName} /T', '', SW_HIDE,
    ewWaitUntilTerminated, ResultCode);
  // Brief pause to ensure file handles are released
  Sleep(500);
end;

// ---------------------------------------------------------------------------
// Custom wizard pages
// ---------------------------------------------------------------------------
procedure InitializeWizard();
begin
  // Server connection settings page
  ServerPage := CreateInputQueryPage(wpSelectDir,
    'إعدادات الاتصال بالخادم',
    'Server Connection Settings',
    'أدخل عنوان خادم السرايا وبيانات المحطة لتهيئة واجهة العميل:' + #13#10 +
    'Enter the Saraya server address and station details:');
  ServerPage.Add('عنوان الخادم والمنفذ — Server Hostname/IP and Port:', False);
  ServerPage.Add('معرّف المحطة — Station ID:', False);
  ServerPage.Add('اسم الفرع / المزرعة — Farm Branch:', False);

  // Set defaults (or existing values on upgrade)
  if IsUpgrade then
  begin
    ServerPage.Values[0] := ExistingHostname;
    if ExistingStationId <> '' then
      ServerPage.Values[1] := ExistingStationId
    else
      ServerPage.Values[1] := '{#DefaultStationId}';
    if ExistingFarmBranch <> '' then
      ServerPage.Values[2] := ExistingFarmBranch
    else
      ServerPage.Values[2] := '{#DefaultFarmBranch}';
  end
  else
  begin
    ServerPage.Values[0] := '{#DefaultHostname}';
    ServerPage.Values[1] := '{#DefaultStationId}';
    ServerPage.Values[2] := '{#DefaultFarmBranch}';
  end;

  // Result summary page
  ResultPage := CreateOutputMsgMemoPage(wpInfoAfter,
    'نتيجة التثبيت',
    'Installation Result',
    'تفاصيل عملية التثبيت:',
    '');
end;

// ---------------------------------------------------------------------------
// Skip connection settings page if upgrading (preserve existing config)
// ---------------------------------------------------------------------------
function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
  if IsUpgrade and (PageID = ServerPage.ID) then
    Result := True;
end;

// ---------------------------------------------------------------------------
// Validate server connection settings
// ---------------------------------------------------------------------------
function NextButtonClick(CurPageID: Integer): Boolean;
var
  Hostname: String;
begin
  Result := True;

  if CurPageID = ServerPage.ID then
  begin
    Hostname := Trim(ServerPage.Values[0]);

    // Hostname must not be empty
    if Length(Hostname) < 1 then
    begin
      MsgBox('يجب إدخال عنوان الخادم.' + #13#10 +
             'Server hostname is required.', mbError, MB_OK);
      Result := False;
      Exit;
    end;

    // Basic format validation: no spaces, no protocol prefix
    if (Pos(' ', Hostname) > 0) then
    begin
      MsgBox('عنوان الخادم لا يجب أن يحتوي على مسافات.' + #13#10 +
             'Hostname must not contain spaces.', mbError, MB_OK);
      Result := False;
      Exit;
    end;

    if (Pos('http://', Hostname) > 0) or (Pos('https://', Hostname) > 0) then
    begin
      MsgBox('أدخل اسم المضيف فقط بدون http:// أو https://' + #13#10 +
             'Enter only the hostname without http:// or https://',
             mbError, MB_OK);
      Result := False;
      Exit;
    end;

    // Station ID validation
    if Length(Trim(ServerPage.Values[1])) < 1 then
    begin
      MsgBox('يجب إدخال معرّف المحطة.' + #13#10 +
             'Station ID is required.', mbError, MB_OK);
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
  Hostname, StationId, FarmBranch: String;
  PrimaryPath, FallbackPath: String;
  PrimaryOk, FallbackOk: Boolean;
  ResultLog: String;
begin
  if CurStep <> ssPostInstall then Exit;

  InstallSuccess := False;
  ResultLog := '';

  // STEP 1: Determine connection settings
  if IsUpgrade then
  begin
    Hostname := ExistingHostname;
    StationId := ExistingStationId;
    FarmBranch := ExistingFarmBranch;
    ResultLog := ResultLog + '• الترقية: تم الحفاظ على إعدادات الاتصال الحالية' + #13#10;
  end
  else
  begin
    Hostname := Trim(ServerPage.Values[0]);
    StationId := Trim(ServerPage.Values[1]);
    FarmBranch := Trim(ServerPage.Values[2]);
    if FarmBranch = '' then
      FarmBranch := '{#DefaultFarmBranch}';
  end;

  ResultLog := ResultLog + '• ملفات التطبيق: تم نسخها بنجاح إلى ' + ExpandConstant('{app}') + #13#10;

  // STEP 2: Write client.json
  WizardForm.StatusLabel.Caption := 'جاري حفظ إعدادات الاتصال بالخادم...';
  PrimaryPath := GetPrimaryConfigPath;
  FallbackPath := GetFallbackConfigPath;
  PrimaryOk := False;
  FallbackOk := False;

  // Try primary path
  PrimaryOk := WriteClientJson(PrimaryPath, Hostname, StationId, FarmBranch);
  if PrimaryOk then
    ResultLog := ResultLog + '• ملف الإعدادات: ' + PrimaryPath + #13#10
  else
    ResultLog := ResultLog + '! تعذرت الكتابة إلى: ' + PrimaryPath + ' (صلاحيات غير كافية)' + #13#10;

  // Always write to fallback (user appdata) if it differs from primary
  if PrimaryPath <> FallbackPath then
  begin
    FallbackOk := WriteClientJson(FallbackPath, Hostname, StationId, FarmBranch);
    if FallbackOk then
      ResultLog := ResultLog + '• ملف إعدادات المستخدم: ' + FallbackPath + #13#10;
  end
  else
    FallbackOk := PrimaryOk;

  if (not PrimaryOk) and (not FallbackOk) then
  begin
    ResultLog := ResultLog + 'X فشل حفظ ملف الإعدادات في جميع المسارات!' + #13#10;
    SetResultText(ResultLog);
    SuppressibleMsgBox(
      'تعذر حفظ ملف إعدادات الاتصال (client.json).' + #13#10 +
      'يمكنك إعادة التهيئة يدوياً باستخدام أداة configure-client.ps1',
      mbError, MB_OK, IDOK);
    Exit;
  end;

  // STEP 3: Register installation in user registry
  RegWriteDWordValue(HKCU,
    'SOFTWARE\Saraya Solutions\Saraya Livestock\Client',
    'InstallComplete', 1);
  RegWriteStringValue(HKCU,
    'SOFTWARE\Saraya Solutions\Saraya Livestock\Client',
    'Version', '{#MyAppVersion}');
  RegWriteStringValue(HKCU,
    'SOFTWARE\Saraya Solutions\Saraya Livestock\Client',
    'ServerHostname', Hostname);

  InstallSuccess := True;

  // Final summary
  ResultLog := ResultLog + #13#10;
  ResultLog := ResultLog + '===========================================' + #13#10;
  ResultLog := ResultLog + 'تم تثبيت واجهة العميل بنجاح!' + #13#10;
  ResultLog := ResultLog + 'Client installation completed successfully!' + #13#10;
  ResultLog := ResultLog + '===========================================' + #13#10#13#10;
  ResultLog := ResultLog + 'إعدادات الاتصال:' + #13#10;
  ResultLog := ResultLog + '  • عنوان الخادم : ' + Hostname + #13#10;
  ResultLog := ResultLog + '  • معرّف المحطة : ' + StationId + #13#10;
  ResultLog := ResultLog + '  • اسم الفرع    : ' + FarmBranch + #13#10#13#10;
  ResultLog := ResultLog + 'رابط الوصول للخادم: https://' + Hostname + #13#10#13#10;
  ResultLog := ResultLog + 'ملاحظة: تأكد من أن خادم السرايا مُثَبَّت ومُشَغَّل على ' + Hostname + #13#10;
  ResultLog := ResultLog + 'وأن شهادة CA مُسجَّلة على هذا الجهاز للاتصال الآمن.' + #13#10;
  ResultLog := ResultLog + 'Note: Ensure the Saraya server is installed and running on ' + Hostname + #13#10;

  SetResultText(ResultLog);
end;

// ---------------------------------------------------------------------------
// Uninstall confirmation
// ---------------------------------------------------------------------------
function InitializeUninstall(): Boolean;
begin
  Result := True;
  if SuppressibleMsgBox(
       'سيتم إزالة واجهة العميل لمنظومة السرايا للماشية.' + #13#10 +
       'ملف إعدادات الاتصال (client.json) سيبقى محفوظاً.' + #13#10#13#10 +
       'هل تريد المتابعة؟' + #13#10 +
       'The Saraya Livestock client will be removed.' + #13#10 +
       'Connection settings (client.json) will be preserved.',
       mbConfirmation, MB_YESNO, IDYES) = IDNO then
    Result := False;
end;

// ---------------------------------------------------------------------------
// Cleanup registry on uninstall
// ---------------------------------------------------------------------------
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
    RegDeleteKeyIncludingSubkeys(HKCU,
      'SOFTWARE\Saraya Solutions\Saraya Livestock\Client');
end;
