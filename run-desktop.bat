@echo off
chcp 65001 >nul
title السرايا للماشية - واجهة سطح المكتب (Electron Client)
echo ====================================================
echo   منظومة السرايا لإدارة مزارع الماشية والألبان
echo   تشغيل واجهة سطح المكتب (Electron Desktop Client)
echo ====================================================
echo.

cd /d "%~dp0\apps\desktop"
npm start

pause
