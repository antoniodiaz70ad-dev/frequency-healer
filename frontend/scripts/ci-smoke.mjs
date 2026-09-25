import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { startLocalServer } from './local-test-server.mjs';

const state = process.argv[2];
assert.ok(['enabled','disabled'].includes(state), 'Use enabled or disabled');
const server = await startLocalServer(state === 'enabled', 'artifacts/smoke-server.log');
try {
  for (const script of ['http-smoke.mjs', 'landing-smoke.mjs']) {
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [`scripts/${script}`, server.origin, state], { stdio: 'inherit', timeout: 60000, killSignal: 'SIGKILL' });
      child.once('error', reject);
      child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`${script} failed: code=${code}, signal=${signal}`)));
    });
  }
} finally { await server.close(); }
