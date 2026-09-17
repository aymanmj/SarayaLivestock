var
  PreparationProgressPage: TOutputProgressWizardPage;
  PreparationUpdateCount: Integer;

procedure PreparationOutput(const S: String; const Error, FirstLine: Boolean);
var
  Rest, Stage, Caption: String;
  Separator, Current, Total: Integer;
begin
  // Only our fixed progress protocol is logged. Other output may contain secrets.
  if Pos('SARAYA_PROGRESS|', S) <> 1 then Exit;
  Rest := Copy(S, 17, MaxInt);
  Separator := Pos('|', Rest);
  if Separator = 0 then Exit;
  Stage := Copy(Rest, 1, Separator - 1);
  Rest := Copy(Rest, Separator + 1, MaxInt);
  Separator := Pos('|', Rest);
  if Separator = 0 then Exit;
  Current := StrToIntDef(Copy(Rest, 1, Separator - 1), -1);
  Total := StrToIntDef(Copy(Rest, Separator + 1, MaxInt), -1);
  if (Current < 0) or (Total < 0) or (Current > Total) then Exit;
  if Stage = 'acl' then Caption := 'جاري التحقق من أذونات الملفات...'
  else if Stage = 'data' then Caption := 'جاري نسخ بيانات قاعدة البيانات والتحقق منها...'
  else if Stage = 'files' then Caption := 'جاري نسخ ملفات البرنامج والتحقق منها...'
  else if Stage = 'config' then Caption := 'جاري نسخ الإعدادات والتحقق منها...'
  else Exit;
  PreparationProgressPage.SetText(Caption, IntToStr(Current) + ' / ' + IntToStr(Total));
  // SetProgress processes window messages so the wizard remains responsive.
  PreparationProgressPage.SetProgress(Current, Total);
  PreparationUpdateCount := PreparationUpdateCount + 1;
  Log(S);
end;

function RunPreparationPowerShell(const ScriptPath, Arguments: String;
  var ExitCode: Integer): Boolean;
var
  CmdLine: String;
begin
  CmdLine := '-NoProfile -ExecutionPolicy Bypass -File "' + ScriptPath + '" ' + Arguments;
  PreparationProgressPage := CreateOutputProgressPage('التحضير للتثبيت',
    'حفظ البيانات والتحقق من الملفات قبل متابعة التثبيت');
  PreparationProgressPage.SetText('جاري تجهيز الملفات...', '');
  PreparationProgressPage.SetProgress(0, 0);
  PreparationProgressPage.Show;
  ExitCode := -1;
  try
    Log('Starting preparation: ' + ExtractFileName(ScriptPath));
    Result := ExecAndLogOutput('powershell.exe', CmdLine, '', SW_HIDE,
      ewWaitUntilTerminated, ExitCode, @PreparationOutput);
    Log('Preparation exit code: ' + IntToStr(ExitCode));
  finally
    PreparationProgressPage.Hide;
  end;
end;
