import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { startHarness } from '../ui/browser-harness.mjs';

assert.equal(process.env.ATENEA_STAGING_ENABLED, 'true', 'This smoke must explicitly enable only the staging page in its isolated local server');
const harness = await startHarness();
try {
  const context = await harness.browser.newContext();
  await context.addInitScript(() => {
    window.__stagingMicrophoneRequests = 0; window.__stagingStorageWrites = 0;
    navigator.mediaDevices.getUserMedia = async () => { window.__stagingMicrophoneRequests++; throw new Error('Must not request microphone without reviewed remote access and consent'); };
    const native = Storage.prototype.setItem;
    Storage.prototype.setItem = function(...args) { window.__stagingStorageWrites++; return native.apply(this, args); };
  });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(harness.origin + '/atenea-voz/pruebas');
  await page.getByRole('heading', { name: 'Prueba de conversación remota' }).waitFor();
  await page.getByText(/La voz remota está deshabilitada/).waitFor();
  const start = page.getByRole('button', { name: 'Iniciar prueba remota' });
  assert.equal(await start.isDisabled(), true);
  await page.getByLabel(/Autorizo enviar audio/).check();
  assert.equal(await start.isDisabled(), true, 'Consent alone never activates remote voice');
  assert.equal(await page.getByRole('button', { name: 'Terminar', exact: true }).isDisabled(), true);
  assert.equal(await page.evaluate(() => window.__stagingMicrophoneRequests), 0);
  assert.equal(await page.evaluate(() => window.__stagingStorageWrites), 0);
  assert.deepEqual(errors, []);
  const directory = process.env.FH_UI_ARTIFACTS_DIR;
  if (directory) { await mkdir(directory, { recursive: true }); await page.screenshot({ path: `${directory}/atenea-staging-disabled.png`, fullPage: true }); }
  await context.close();
  console.log('Staging page smoke: PASS; no configured identity/provider, no microphone, no storage writes');
} finally { await harness.close(); }
