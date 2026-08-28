@echo off
title National Legal Metrology Platform (PostgreSQL + Backend + Web Portal + Admin Portal)
cd /d "%~dp0"

echo ======================================================================
echo   National Legal Metrology Verification Platform
echo   Ministry of Consumer Affairs, Food & Public Distribution
echo ======================================================================
echo   [1/4] Checking PostgreSQL Database Service (Port 5432)...
powershell -Command "$svc = Get-Service -Name *postgres* -ErrorAction SilentlyContinue; if ($svc -and $svc.Status -ne 'Running') { Write-Host '[POSTGRES] Starting PostgreSQL service...' -ForegroundColor Yellow; Start-Service -Name $svc.Name -ErrorAction SilentlyContinue }"

echo   [2/4] Starting Fastify Backend Server on Port 8000...
echo   [3/4] Starting Verification Web Portal on Port 5173...
echo   [4/4] Starting Admin Control Plane on Port 5174...
echo ======================================================================
echo.

node run.js %*

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [RUNNER] Platform runner exited. Press any key to close.
    pause >nul
)
