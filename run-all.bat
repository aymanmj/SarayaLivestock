@echo off
chcp 65001 >nul
title السرايا للماشية - تشغيل المنظومة المتكاملة
echo ====================================================
echo   منظومة السرايا لإدارة مزارع الماشية والألبان
echo   تشغيل الخوادم وواجهة سطح المكتب (Electron)
echo ====================================================
echo.

echo [1/3] جاري بدء سيرفر الـ API في نافذة خلفية (Port 4000)...
start "Saraya API (Port 4000)" cmd /k "cd /d %~dp0\apps\api && npm run dev"

echo [2/3] جاري بدء سيرفر الواجهة (Web) في نافذة خلفية (Port 3050)...
start "Saraya Web (Port 3050)" cmd /k "cd /d %~dp0\apps\web && npm run dev"

echo [3/3] انتظار 3 ثوانٍ ثم تشغيل واجهة سطح المكتب (Electron)...
timeout /t 3 /nobreak >nul

cd /d "%~dp0\apps\desktop"
npm start
