import { spawn } from 'node:child_process';

const children = [
  spawn('tsx', ['watch', 'src/server/index.ts'], { stdio: 'inherit' }),
  spawn('vite', [], { stdio: 'inherit' }),
];

let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  process.exit(code);
}

for (const child of children) {
  child.on('exit', (code) => {
    if (!stopping) stop(code ?? 1);
  });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
