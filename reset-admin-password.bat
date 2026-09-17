@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell.exe -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"E:\SarayaLivestock\reset-admin-password.ps1\"' -Verb RunAs"
