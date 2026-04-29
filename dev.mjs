import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import electron from 'electron';

const vite = await createServer({ configFile: 'vite.renderer.config.ts' });
await vite.listen();

const port = vite.config.server.port ?? vite.httpServer.address().port;
console.log(`Vite dev server running on port ${port}`);

const proc = spawn(String(electron), ['.'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_PORT: String(port) },
});

proc.on('close', () => {
  vite.close();
  process.exit();
});

process.on('SIGINT', () => {
  proc.kill();
  vite.close();
  process.exit();
});
