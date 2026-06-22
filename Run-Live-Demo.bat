@echo off
cd /d "%~dp0"
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "docs\defense\run-live-demo.ps1"
pause
