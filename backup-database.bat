@echo off
chcp 65001 >nul
title Saraya Livestock - Verified PostgreSQL Backup
cd /d "%~dp0apps\api"

echo Creating a custom-format PostgreSQL backup with SHA-256 manifest...
echo DATABASE_URL is loaded from apps\api\.env or the process environment.
echo.

call npm run db:backup
if errorlevel 1 (
  echo.
  echo Backup failed. No success claim has been made; review the error above.
  pause
  exit /b 1
)

echo.
echo Backup and archive verification completed successfully.
pause
