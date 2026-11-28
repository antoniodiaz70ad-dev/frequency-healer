import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { startHarness, observeBrowser } from './browser-harness.mjs';
let harness;
before(async () => { harness = await startHarness(); }, { timeout: 60000 });
after(async () => { await harness?.close(); });

async function readResult(page) {
  const href = await page.getByRole('link', { name: 'Guardar ficha de configuración', exact: true }).getAttribute('href');
  return page.evaluate(async url => JSON.parse(await (await fetch(url)).text()), href);
}
test('real worker exports full stereo WAV offline without playing audio or writing practices; cancellation remains reusable', { timeout: 90000 }, async t => {
  const context = await harness.browser.newContext({ viewport: { width: 390, height: 844 } }); t.after(() => context.close());
  await context.addInitScript(observeBrowser); const page = await context.newPage();
  await page.goto(harness.origin + '/practicar');
  await page.getByLabel('Duración de la práctica', { exact: true }).selectOption('5');
  await page.getByText('Escuchar sin conexión · descargar sesión', { exact: true }).click();
  await page.getByRole('button', { name: 'Preparar descarga', exact: true }).click();
  await page.getByRole('button', { name: 'Cancelar descarga', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Preparación cancelada.' }).waitFor();
  await page.getByRole('button', { name: 'Preparar descarga', exact: true }).click();
  await page.getByRole('link', { name: 'Guardar audio WAV', exact: true }).waitFor({ timeout: 60000 });
  const metadata = await readResult(page);
  assert.equal(metadata.seconds, 300); assert.equal(metadata.format.frames, 300 * 22050);
  assert.equal(metadata.configuration.layers[0].rateHz, 15); assert.deepEqual(metadata.includedRecordings, []);
  // A local blob remains readable after cutting the network; inspect its actual PCM payload.
  const href = await page.getByRole('link', { name: 'Guardar audio WAV', exact: true }).getAttribute('href');
  await context.setOffline(true);
  const wav = await page.evaluate(async url => {
    const data = await (await fetch(url)).arrayBuffer(), view = new DataView(data), sr = view.getUint32(24, true);
    return { bytes: data.byteLength, sr, channels: view.getUint16(22, true), dataBytes: view.getUint32(40, true),
      left: view.getInt16(44 + sr * 5 * 4 + 4, true), right: view.getInt16(44 + sr * 5 * 4 + 6, true),
      state: window.__fhUI.snapshot() };
  }, href);
  assert.equal(wav.bytes, metadata.format.bytes); assert.equal(wav.dataBytes, wav.bytes - 44); assert.equal(wav.channels, 2);
  assert.notEqual(wav.left, wav.right); assert.deepEqual(wav.state.writes, []); assert.deepEqual(wav.state.contexts, []);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Guardar audio WAV', exact: true }).click()]);
  assert.equal((await stat(await download.path())).size, metadata.format.bytes);
});
test('Arthur export decodes existing clips and reports four of six phases; fetch failure never exposes partial audio', { timeout: 120000 }, async t => {
  const context = await harness.browser.newContext(); t.after(() => context.close()); const page = await context.newPage();
  await page.goto(harness.origin + '/marina-punto-cero');
  await page.getByLabel('Leer instrucciones con voz', { exact: true }).check();
  await page.getByText('Escuchar sin conexión · descargar sesión', { exact: true }).click();
  await page.route('**/audio/arthur-es-v1/marina-emotion.mp3', route => route.abort());
  await page.getByRole('button', { name: 'Preparar descarga', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'No se pudo cargar Arthur' }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Guardar audio WAV', exact: true }).count(), 0);
  await page.unroute('**/audio/arthur-es-v1/marina-emotion.mp3');
  await page.getByRole('button', { name: 'Preparar descarga', exact: true }).click();
  await page.getByRole('link', { name: 'Guardar audio WAV', exact: true }).waitFor({ timeout: 90000 });
  const metadata = await readResult(page);
  assert.equal(metadata.seconds, 1440); assert.equal(metadata.voice.phases, 6); assert.equal(metadata.includedRecordings.length, 4);
  assert.equal(metadata.format.sampleRate, 44100);
  assert.deepEqual(metadata.includedRecordings.map(v => v.at), [0, 240, 420, 900]);
});
