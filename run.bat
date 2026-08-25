@echo off
title National e-Metrology Platform (Backend + Frontend + Admin)
cd /d "%~dp0"

echo ======================================================================
echo   National e-Metrology Verification & Digital Certification Platform
echo ======================================================================
echo   Launching Backend API (Port 8000) and Frontend Portal (Port 5173)...
echo   Add --admin to also start the ADMIN Control Plane (Port 5174).
echo ======================================================================
echo.

python run.py %*

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [RUNNER] Python runner exited. Press any key to close.
    pause >nul
)
