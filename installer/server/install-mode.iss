// 0 = fresh installation, 1 = upgrade, 2 = resume incomplete installation.
function ClassifyInstallation(HasConfig, HasCluster, HasRegistration,
  Completed: Boolean): Integer;
begin
  // Never downgrade a completed or unregistered database to a fresh install.
  if Completed or (HasCluster and ((not HasRegistration) or (not HasConfig))) then
    Result := 1
  else if HasRegistration or HasConfig then
    Result := 2
  else
    Result := 0;
end;
