import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const frontendDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const frontend = spawn('npm', ['run', 'dev:vite'], {
  cwd: frontendDirectory,
  stdio: 'inherit',
});

process.on('SIGINT', () => frontend.kill('SIGINT'));
process.on('SIGTERM', () => frontend.kill('SIGTERM'));
frontend.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal === 'SIGINT' || signal === 'SIGTERM' ? 0 : 1);
});
