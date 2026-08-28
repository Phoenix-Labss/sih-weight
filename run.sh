#!/usr/bin/env bash
# Bash launcher for National e-Metrology Platform
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "======================================================================"
echo "  National e-Metrology Verification & Digital Certification Platform"
echo "  Launching Backend API (Port 8000) and Frontend Portal (Port 5173)..."
echo "======================================================================"

node run.js "$@"
