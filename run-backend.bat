@echo off
echo ========================================================
echo   Starting Civic Lens Backend (Port 5001)...
echo ========================================================
cd /d "%~dp0backend"
call npm.cmd run dev
pause
