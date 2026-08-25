#!/usr/bin/env python3
"""Unified Runner for Legal Metrology Instrument Verification Platform.
Starts both the FastAPI Backend (port 8000) and React Vite Frontend (port 5173) concurrently.
"""

import os
import sys
import time
import signal
import subprocess
import threading
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "apps" / "verification-web"
ADMIN_FRONTEND_DIR = ROOT_DIR / "apps" / "admin-portal"

# Terminal Colors
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BOLD = "\033[1m"
RESET = "\033[0m"

processes = []


def stream_logs(process, prefix, color):
    """Stream stdout and stderr with colored prefixes."""
    try:
        for line in iter(process.stdout.readline, ""):
            if not line:
                break
            print(f"{color}[{prefix}]{RESET} {line.rstrip()}")
    except Exception:
        pass


def cleanup(signum=None, frame=None):
    """Gracefully terminate backend and frontend processes."""
    print(f"\n{YELLOW}[RUNNER] Shutting down e-Metrology platform servers...{RESET}")
    for p in processes:
        if p.poll() is None:
            try:
                if sys.platform == "win32":
                    subprocess.run(["taskkill", "/F", "/T", "/PID", str(p.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                else:
                    p.terminate()
            except Exception:
                pass
    print(f"{GREEN}[RUNNER] All servers stopped cleanly. Goodbye!{RESET}\n")
    sys.exit(0)


def free_port(port):
    """Ensure port is available by killing any lingering process on it."""
    try:
        if sys.platform == "win32":
            output = subprocess.check_output(
                f"netstat -ano | findstr :{port}", shell=True, text=True, stderr=subprocess.DEVNULL
            )
            for line in output.strip().splitlines():
                parts = line.split()
                if len(parts) >= 5 and "LISTENING" in parts:
                    pid = parts[-1]
                    if pid != "0" and pid != str(os.getpid()):
                        print(f"{YELLOW}[RUNNER] Freeing port {port} (terminating stale process PID {pid})...{RESET}")
                        subprocess.run(["taskkill", "/F", "/PID", pid], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            output = subprocess.check_output(["lsof", "-ti", f":{port}"], text=True, stderr=subprocess.DEVNULL)
            for pid in output.strip().splitlines():
                if pid and pid != str(os.getpid()):
                    subprocess.run(["kill", "-9", pid], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass


def main():
    signal.signal(signal.SIGINT, cleanup)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, cleanup)

    include_admin = "--admin" in sys.argv

    print("=" * 70)
    print(f"{BOLD}{GREEN}  National e-Metrology Verification & Certification Platform{RESET}")
    print("=" * 70)
    print(f"  • {BOLD}Backend API:{RESET}    http://127.0.0.1:8000 (Fastify + TypeScript)")
    print(f"  • {BOLD}Frontend Portal:{RESET} http://localhost:5173")
    if include_admin:
        print(f"  • {BOLD}Admin Portal:{RESET}   http://localhost:5174 (ADMIN only, --admin)")
    print(f"  • {BOLD}Working Root:{RESET}   {ROOT_DIR}")
    print("=" * 70)

    # Automatically ensure ports are free
    free_port(8000)
    free_port(5173)
    if include_admin:
        free_port(5174)

    print(f"{YELLOW}[RUNNER] Starting Fastify TypeScript Backend on port 8000...{RESET}")

    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"

    # 1. Start Backend Process (Fastify + TypeScript)
    backend_proc = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd=str(BACKEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        shell=(sys.platform == "win32"),
    )
    processes.append(backend_proc)

    backend_thread = threading.Thread(
        target=stream_logs, args=(backend_proc, "BACKEND", CYAN), daemon=True
    )
    backend_thread.start()

    time.sleep(1.0)
    print(f"{YELLOW}[RUNNER] Starting React Vite Frontend on port 5173...{RESET}")

    # 2. Start Frontend Process
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    frontend_proc = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd=str(FRONTEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        shell=(sys.platform == "win32"),
    )
    processes.append(frontend_proc)

    frontend_thread = threading.Thread(
        target=stream_logs, args=(frontend_proc, "FRONTEND", GREEN), daemon=True
    )
    frontend_thread.start()

    admin_proc = None
    if include_admin:
        print(f"{YELLOW}[RUNNER] Starting Admin Portal on port 5174...{RESET}")
        admin_proc = subprocess.Popen(
            [npm_cmd, "run", "dev"],
            cwd=str(ADMIN_FRONTEND_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            shell=(sys.platform == "win32"),
        )
        processes.append(admin_proc)
        threading.Thread(
            target=stream_logs, args=(admin_proc, "ADMIN-UI", YELLOW), daemon=True
        ).start()

    print(f"\n{BOLD}{GREEN}[RUNNER] Servers are live! Press Ctrl+C to stop anytime.{RESET}\n")

    try:
        while True:
            # Check if any process died unexpectedly
            if backend_proc.poll() is not None:
                print(f"{RED}[RUNNER] Backend exited with code {backend_proc.returncode}{RESET}")
                break
            if frontend_proc.poll() is not None:
                print(f"{RED}[RUNNER] Frontend exited with code {frontend_proc.returncode}{RESET}")
                break
            if admin_proc is not None and admin_proc.poll() is not None:
                print(f"{RED}[RUNNER] Admin portal exited with code {admin_proc.returncode}{RESET}")
                break
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        cleanup()


if __name__ == "__main__":
    main()
