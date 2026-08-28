#!/usr/bin/env node
/**
 * Unified Runner for National Legal Metrology Verification Platform.
 * Automatically checks PostgreSQL and launches all 3 platform servers:
 *  1. Fastify TypeScript Backend (port 8000)
 *  2. Main Verification Web Portal (port 5173) [Trader, LMO, GATC, Supervisor, Governance, QR]
 *  3. Dedicated Admin Control Plane (port 5174) [System Administrator DB Browser, Health & Audit]
 */

import { spawn, execSync } from 'child_process';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = __dirname;
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const FRONTEND_DIR = path.join(ROOT_DIR, 'apps', 'verification-web');
const ADMIN_DIR = path.join(ROOT_DIR, 'apps', 'admin-portal');

const colors = {
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

const processes = [];

function checkPostgresPort(port = 5432) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1500);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

async function ensurePostgres() {
  console.log(`${colors.cyan}[POSTGRES] Checking PostgreSQL Database on port 5432...${colors.reset}`);
  let isRunning = await checkPostgresPort(5432);

  if (!isRunning && process.platform === 'win32') {
    console.log(`${colors.yellow}[POSTGRES] PostgreSQL port 5432 is not responding. Starting Windows PostgreSQL service...${colors.reset}`);
    try {
      execSync('powershell -Command "Get-Service -Name *postgres* -ErrorAction SilentlyContinue | Start-Service -ErrorAction SilentlyContinue"', { stdio: 'ignore' });
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 500));
        isRunning = await checkPostgresPort(5432);
        if (isRunning) break;
      }
    } catch {
      // Ignore
    }
  }

  if (isRunning) {
    console.log(`${colors.green}[POSTGRES] ✓ PostgreSQL is active and accepting connections on localhost:5432 (emetrology_db)${colors.reset}`);
  } else {
    console.log(`${colors.yellow}[POSTGRES] ⚠ Warning: Could not connect to PostgreSQL on port 5432. The backend will attempt automatic retry.${colors.reset}`);
  }
}

function freePort(port) {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${port} || exit 0`, { encoding: 'utf-8' });
      const lines = output.trim().split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5 && parts[1].endsWith(`:${port}`)) {
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0') {
            try {
              execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
            } catch {
              // Ignore
            }
          }
        }
      }
    }
  } catch {
    // Ignore
  }
}

function startProcess(name, cmd, args, cwd, color) {
  const isWin = process.platform === 'win32';
  const proc = spawn(isWin ? `${cmd}.cmd` : cmd, args, {
    cwd,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true,
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  proc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const l of lines) {
      if (l.trim()) {
        console.log(`${color}[${name}]${colors.reset} ${l}`);
      }
    }
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const l of lines) {
      if (l.trim()) {
        console.log(`${colors.red}[${name} ERR]${colors.reset} ${l}`);
      }
    }
  });

  proc.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.log(`${colors.yellow}[${name}] Exited with code ${code}${colors.reset}`);
    }
  });

  processes.push({ name, proc });
  return proc;
}

function cleanup() {
  console.log(`\n${colors.yellow}[RUNNER] Shutting down all platform services...${colors.reset}`);
  for (const { proc } of processes) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: 'ignore' });
      } else {
        proc.kill('SIGTERM');
      }
    } catch {
      // Ignore
    }
  }
  console.log(`${colors.green}[RUNNER] All servers stopped cleanly.${colors.reset}\n`);
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

async function main() {
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.green}  National Legal Metrology Verification & Digital Certification Platform${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`  Database:             ${colors.bold}localhost:5432${colors.reset} (PostgreSQL 18 - emetrology_db)`);
  console.log(`  Backend API:          ${colors.bold}http://localhost:8000${colors.reset} (Fastify + Prisma ORM)`);
  console.log(`  Main Web Portal:      ${colors.bold}http://localhost:5173${colors.reset} (Admin, Trader, LMO, GATC, SLA, QR)`);
  console.log(`  Admin Control Plane:  ${colors.bold}http://localhost:5174${colors.reset} (Dedicated DB Browser & Health Console)`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

  // 1. Ensure PostgreSQL is active
  await ensurePostgres();

  // 2. Free any stale port allocations
  freePort(8000);
  freePort(5173);
  freePort(5174);

  // 3. Start Backend Fastify API (Port 8000)
  console.log(`\n${colors.cyan}[RUNNER] [1/3] Launching Fastify Backend Server on port 8000...${colors.reset}`);
  startProcess('BACKEND', 'npm', ['run', 'dev'], BACKEND_DIR, colors.cyan);

  // 4. Start Main Verification Web Portal (Port 5173)
  setTimeout(() => {
    console.log(`${colors.green}[RUNNER] [2/3] Launching Verification Web Portal on port 5173...${colors.reset}`);
    startProcess('WEB-PORTAL', 'npm', ['run', 'dev'], FRONTEND_DIR, colors.green);
  }, 1800);

  // 5. Start Admin Control Plane Portal (Port 5174)
  setTimeout(() => {
    console.log(`${colors.magenta}[RUNNER] [3/3] Launching Admin Control Plane Portal on port 5174...${colors.reset}`);
    startProcess('ADMIN-PORTAL', 'npm', ['run', 'dev'], ADMIN_DIR, colors.magenta);
  }, 2500);
}

main().catch((err) => {
  console.error('[RUNNER] Fatal startup error:', err);
  process.exit(1);
});
