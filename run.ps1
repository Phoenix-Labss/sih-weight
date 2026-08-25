# PowerShell launcher for National e-Metrology Platform
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  National e-Metrology Verification & Digital Certification Platform" -ForegroundColor Green
Write-Host "  Launching Backend API (Port 8000) and Frontend Portal (Port 5173)..." -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

python run.py @args
