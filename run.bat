@echo off
setlocal
title National Legal Metrology Platform (Backend + Web Portal + Admin Portal)
cd /d "%~dp0"

echo ======================================================================
echo   National Legal Metrology Verification Platform
echo   Ministry of Consumer Affairs, Food ^& Public Distribution
echo ======================================================================

echo   [1/5] Checking prerequisites (Node.js + npm)...

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo   [ERROR] Node.js is NOT installed on this computer.
    echo           Download and install the LTS version from https://nodejs.org
    echo           Then run run.bat again.
    goto :fail
)

for /f "delims=" %%v in ('node --version 2^>nul') do set "NODE_VER=%%v"
echo           Node.js %NODE_VER% detected.

where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo   [ERROR] npm was not found even though Node.js is installed.
    echo           Please reinstall Node.js LTS from https://nodejs.org
    goto :fail
)

echo.
echo   The runner below automatically:
echo     [2/5] Installs missing dependencies for:
echo             - backend\                 (Fastify + Prisma API,  port 8000)
echo             - apps\verification-web\   (Web Portal,            port 5173)
echo             - apps\admin-portal\       (Admin Control Plane,   port 5174)
echo     [3/5] Creates backend\.env with a default database URL if missing
echo     [4/5] Generates the Prisma client and syncs/seeds the database
echo     [5/5] Starts the backend and both portals
echo.
echo   First run may take several minutes while packages are downloaded.
echo   Close this window or press Ctrl+C to stop all servers.
echo ======================================================================
echo.

node run.js %*
set "RUNNER_EXIT=%ERRORLEVEL%"

if %RUNNER_EXIT% NEQ 0 goto :fail

echo.
echo   All platform services stopped. Press any key to close this window.
pause >nul
endlocal
exit /b 0

:fail
echo.
echo ======================================================================
echo   [ERROR] The platform did not start successfully.
echo   Read the messages above to identify the problem, fix it, and run
echo   run.bat again. This window stays open so errors remain visible.
echo ======================================================================
pause
endlocal
exit /b 1
