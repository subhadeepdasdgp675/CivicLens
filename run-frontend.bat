@echo off
echo ========================================================
echo   Starting Civic Lens Frontend (Port 8080)...
echo ========================================================
cd /d "%~dp0frontend"
call npm.cmd run dev
pause
