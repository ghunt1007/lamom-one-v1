@echo off
chcp 65001 >nul
cd /d "%~dp0"
node scripts\setup-daily-report.mjs %1
pause
