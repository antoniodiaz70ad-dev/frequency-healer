import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { startLocalServer } from '../scripts/local-test-server.mjs';

let server, browser;
const enabled = process.env.ATENEA_VOICE_ENABLED === 'true';
before(async () => {
  server = await startLocalServer(true);
  if (enabled) browser = await chromium.launch({ headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    ...(process.env.FH_UI_BROWSER_PATH ? { executablePath: process.env.FH_UI_BROWSER_PATH } : {}) });
}, { timeout: 60000 });
after(async () => { try { await browser?.close(); } finally { await server?.close(); } });

test('server flag and API fail closed, including cross-origin requests', async () => {
  const page = await fetch(server.origin + '/atenea-voz');
  assert.equal(page.status, enabled ? 200 : 404);
  // Staging has a separate, absent-by-default gate even when the local simulator is enabled.
  assert.equal((await fetch(server.origin + '/atenea-voz/pruebas')).status, 404);
  assert.equal((await fetch(server.origin + '/api/atenea-voz/access')).status, enabled ? 503 : 404);
  for (const origin of [server.origin, 'https://untrusted.test', null]) {
    const response = await fetch(server.origin + '/api/atenea-voz/session', { method: 'POST', headers: origin ? { origin } : {} });
    assert.equal(response.status, !enabled ? 404 : origin === server.origin ? 503 : 403);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.text()).includes('client_secret'), false);
  }
});

test('staging identity page and probe remain closed without separate staging configuration', async () => {
  assert.equal((await fetch(server.origin + '/atenea-acceso')).status, 404);
  const response = await fetch(server.origin + '/api/atenea-voz/identity-check', { method: 'POST' });
  assert.equal(response.status, 404); assert.equal(response.headers.get('cache-control'), 'no-store');
});

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`local session, mic cleanup and privacy at ${viewport.width}px`, { skip: !enabled, timeout: 30000 }, async () => {
    const context = await browser.newContext({ viewport, permissions: ['microphone'] });
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.__micTracks = [];
      const native = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async options => {
        const stream = await native(options); window.__micTracks.push(...stream.getTracks()); return stream;
      };
      window.__storageWrites = [];
      const nativeSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) { window.__storageWrites.push(key); return nativeSet.call(this, key, value); };
    });
    await page.goto(server.origin + '/atenea-voz');
    await page.getByRole('heading', { name: 'Un espacio para escucharte' }).waitFor();
    assert.equal(await page.evaluate(() => window.__micTracks.length), 0);
    await page.getByLabel(/Entiendo que/).check();
    await page.getByLabel(/Probar mi micrófono/).check();
    await page.getByRole('button', { name: 'Iniciar simulación', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Sesión activa' }).waitFor();
    assert.equal(await page.evaluate(() => window.__micTracks[0].readyState), 'live');
    await page.getByRole('button', { name: 'Pausa', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__micTracks[0].enabled), false);
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.getByRole('button', { name: 'más silencio', exact: true }).click();
    await page.getByText(/Silencio. El micrófono/).waitFor();
    await page.getByLabel('Simular una frase reconocida').fill('ATENEA, terminar');
    await page.getByRole('button', { name: 'Enviar turno simulado' }).click();
    await page.getByRole('status').filter({ hasText: 'Finalizada' }).waitFor();
    assert.equal(await page.evaluate(() => window.__micTracks.every(track => track.readyState === 'ended')), true);
    assert.equal(await page.getByRole('button', { name: 'Descargar contenido aprobado' }).isDisabled(), true);
    assert.deepEqual(await page.evaluate(() => window.__storageWrites), []);
    assert.deepEqual(errors, []);
    const artifacts = process.env.FH_UI_ARTIFACTS_DIR;
    if (artifacts) { await mkdir(artifacts, { recursive: true }); await page.screenshot({ path: `${artifacts}/atenea-${viewport.width}.png`, fullPage: true }); }
    await context.close();
  });
}
