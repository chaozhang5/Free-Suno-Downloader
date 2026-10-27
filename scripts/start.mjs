import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { backendEnv } from './backend-env.mjs';

const frontendDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const server = spawn(process.execPath, ['../backend/server.js'], {
  cwd: frontendDirectory,
  env: backendEnv(),
  stdio: 'inherit',
});

process.on('SIGINT', () => server.kill('SIGINT'));
process.on('SIGTERM', () => server.kill('SIGTERM'));
server.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal === 'SIGINT' || signal === 'SIGTERM' ? 0 : 1);
});
