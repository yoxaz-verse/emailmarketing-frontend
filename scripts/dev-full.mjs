import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dashboardDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendDir = path.resolve(dashboardDir, '..', 'Backend');
const dashboardPort = String(process.env.DASHBOARD_PORT || '3001');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const children = [
  spawn(npmCommand, ['run', 'dev'], {
    cwd: backendDir,
    stdio: 'inherit',
    env: process.env,
  }),
  spawn(npmCommand, ['run', 'dev', '--', '-p', dashboardPort], {
    cwd: dashboardDir,
    stdio: 'inherit',
    env: process.env,
  }),
];

let stopping = false;

function stop(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => stop(signal));
}

for (const child of children) {
  child.on('error', (error) => {
    console.error('[dev:full] Failed to start a service:', error.message);
    process.exitCode = 1;
    stop();
  });

  child.on('exit', (code, signal) => {
    if (stopping) return;
    if (code !== 0) {
      console.error(`[dev:full] A service stopped unexpectedly (${signal || `exit ${code}`}).`);
      process.exitCode = code || 1;
    }
    stop();
  });
}
