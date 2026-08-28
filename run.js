#!/usr/bin/env node
/**
 * Unified Node.js Runner for Legal Metrology Platform.
 * Launches Fastify TypeScript Backend (port 8000), Verification Web Portal (port 5173),
 * and optionally the Admin Portal (port 5174).
 */

import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = __dirname;
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const FRONTEND_DIR = path.join(ROOT_DIR, 'apps', 'verification-web');
const ADMIN_DIR = path.join(ROOT_DIR, 'apps', 'admin-portal');

const includeAdmin = process.argv.includes('--admin');

const colors = {
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

const processes = [];

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

console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
console.log(`${colors.bold}${colors.green}  National Legal Metrology Verification & Digital Certification Platform${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
console.log(`  Backend API:          ${colors.bold}http://localhost:8000${colors.reset} (Fastify + Prisma)`);
console.log(`  Verification Portal:  ${colors.bold}http://localhost:5173${colors.reset} (Trader / Officer / Supervisor / Public)`);
if (includeAdmin) {
  console.log(`  Admin Control Plane:  ${colors.bold}http://localhost:5174${colors.reset} (System Administrator)`);
}
console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

// Free ports
freePort(8000);
freePort(5173);
if (includeAdmin) freePort(5174);

// 1. Start Backend API
console.log(`${colors.cyan}[RUNNER] Starting Fastify TypeScript Backend on port 8000...${colors.reset}`);
startProcess('BACKEND', 'npm', ['run', 'dev'], BACKEND_DIR, colors.cyan);

// 2. Start Frontend Web Portal
setTimeout(() => {
  console.log(`${colors.green}[RUNNER] Starting Verification Web Portal on port 5173...${colors.reset}`);
  startProcess('WEB-PORTAL', 'npm', ['run', 'dev'], FRONTEND_DIR, colors.green);
}, 1500);

// 3. Start Admin Portal (if requested)
if (includeAdmin) {
  setTimeout(() => {
    console.log(`${colors.magenta}[RUNNER] Starting Admin Control Plane on port 5174...${colors.reset}`);
    startProcess('ADMIN-PORTAL', 'npm', ['run', 'dev'], ADMIN_DIR, colors.magenta);
  }, 2000);
}
