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

node run.js %*

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [RUNNER] Node runner exited. Press any key to close.
    pause >nul
)
