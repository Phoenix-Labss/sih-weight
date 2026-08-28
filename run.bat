@echo off
title National Legal Metrology Platform (PostgreSQL + Backend + Frontend)
cd /d "%~dp0"

echo ======================================================================
echo   National Legal Metrology Verification Platform
echo   Ministry of Consumer Affairs, Food & Public Distribution
echo ======================================================================
echo   [1/3] Checking PostgreSQL Database Service (Port 5432)...
powershell -Command "$svc = Get-Service -Name *postgres* -ErrorAction SilentlyContinue; if ($svc -and $svc.Status -ne 'Running') { Write-Host '[POSTGRES] Starting PostgreSQL service...' -ForegroundColor Yellow; Start-Service -Name $svc.Name -ErrorAction SilentlyContinue }"

echo   [2/3] Initializing Unified Runner (Backend Port 8000, Frontend Port 5173)...
echo ======================================================================
echo.

node run.js %*

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [RUNNER] Platform runner exited. Press any key to close.
    pause >nul
)
