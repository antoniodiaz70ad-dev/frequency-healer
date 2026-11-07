import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { startLocalServer } from './local-test-server.mjs';

const state = process.argv[2];
assert.ok(['enabled','disabled'].includes(state), 'Use enabled or disabled');
const server = await startLocalServer(state === 'enabled', 'artifacts/smoke-server.log');
try {
  const fire = await fetch(server.origin + '/prueba-de-fuego');
  assert.equal(fire.status, state === 'enabled' ? 200 : 404, 'Prueba de Fuego must follow its build flag');
  const home = await (await fetch(server.origin + '/inicio')).text();
  assert.equal(home.includes('href="/prueba-de-fuego"'), state === 'enabled', 'Prueba de Fuego navigation must follow its build flag');
  for (const script of ['http-smoke.mjs', 'landing-smoke.mjs']) {
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [`scripts/${script}`, server.origin, state], { stdio: 'inherit', timeout: 60000, killSignal: 'SIGKILL' });
      child.once('error', reject);
      child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`${script} failed: code=${code}, signal=${signal}`)));
    });
  }
} finally { await server.close(); }
