import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** Isolated loopback server shared by UI and smoke runners. Never targets deploys. */
export async function startLocalServer(enabled, logFile) {
  const reservation = createServer();
  await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve); });
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    env: { ...process.env, NEXT_PUBLIC_VOICE_JOURNEY_ENABLED: String(enabled), NEXT_PUBLIC_HARMONIC_LAB_ENABLED: String(enabled), VOICE_AI_ENABLED: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '', spawnError, closing;
  server.on('error', error => { spawnError = error; });
  server.stdout.on('data', chunk => { log += chunk; });
  server.stderr.on('data', chunk => { log += chunk; });
  const close = () => closing ??= (async () => {
    process.off('SIGTERM', terminate); process.off('SIGINT', interrupt);
    if (server.pid && server.exitCode === null && server.signalCode === null) {
      const exited = new Promise(resolve => server.once('exit', resolve));
      server.kill('SIGTERM');
      const timer = setTimeout(() => server.kill('SIGKILL'), 5000);
      await exited; clearTimeout(timer);
    }
    if (logFile) { await mkdir(dirname(logFile), { recursive: true }); await writeFile(logFile, log); }
  })();
  const terminate = () => { void close().finally(() => process.exit(143)); };
  const interrupt = () => { void close().finally(() => process.exit(130)); };
  process.once('SIGTERM', terminate); process.once('SIGINT', interrupt);
  try {
    const deadline = Date.now() + 20000;
    for (;;) {
      if (spawnError) throw spawnError;
      assert.ok(server.exitCode === null && server.signalCode === null, log);
      try {
        const response = await fetch(origin + '/', { signal: AbortSignal.timeout(2000) });
        assert.equal(response.status, 200);
        break;
      } catch (error) {
        if (Date.now() >= deadline) throw new Error(`Server readiness timeout. ${log}`, { cause: error });
        await delay(100);
      }
    }
    return { origin, close };
  } catch (error) { await close(); throw error; }
}
