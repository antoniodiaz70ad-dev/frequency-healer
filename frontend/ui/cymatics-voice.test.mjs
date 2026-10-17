import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startHarness, eventually } from './browser-harness.mjs';
let harness;
before(async () => { harness = await startHarness(); }, {timeout: 60000});
after(async () => { await harness?.close(); });
async function fixture(t, viewport) {
  const context = await harness.browser.newContext({viewport: viewport ?? {width: 1280, height: 900}});
  t.after(() => context.close());
  await context.addInitScript(() => {
    // Synthetic microphone, real Web Audio analysis; never requests a physical device.
    window.__voiceProbe = {tracks: [], context: null, gain: null, oscillator: null};
    navigator.mediaDevices.getUserMedia = async () => {
      const audio = new AudioContext(), oscillator = audio.createOscillator(), gain = audio.createGain(), destination = audio.createMediaStreamDestination();
      oscillator.frequency.value = 220; gain.gain.value = .25;
      oscillator.connect(gain); gain.connect(destination); oscillator.start(); await audio.resume();
      Object.assign(window.__voiceProbe, {context: audio, oscillator, gain, tracks: destination.stream.getTracks()});
      return destination.stream;
    };
  });
  const page = await context.newPage();
  await page.goto(harness.origin + '/laboratorio-cimatico');
  return page;
}
async function pitchNear(page, expected) {
  await eventually(async () => {
    const text = await page.locator('[class*="voiceMetrics"]').innerText();
    const hz = Number(text.match(/Mi tono\s+([\d.]+) Hz/)?.[1]);
    assert.ok(Math.abs(hz - expected) < 2, text);
  });
}
test('live voice follows pitch, clears silence, captures A/B, exports without audio and stops tracks', {timeout: 45000}, async t => {
  const page = await fixture(t);
  await page.getByRole('button', {name: 'Conectar mi voz en vivo'}).click();
  await pitchNear(page, 220);
  await page.getByRole('img', {name: 'Cimática de mi voz en vivo', exact: true}).waitFor();
  await page.getByRole('button', {name: 'Capturar tono vocal A'}).click();
  await page.evaluate(() => { window.__voiceProbe.oscillator.frequency.value = 330; });
  await pitchNear(page, 330);
  await page.getByRole('button', {name: 'Capturar tono vocal B'}).click();
  assert.equal(await page.getByRole('img', {name: 'Captura vocal A', exact: true}).count(), 1);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Exportar comparación de voz'}).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream(); let content = ''; for await (const chunk of stream) content += chunk;
  const data = JSON.parse(content); assert.equal(data.kind, 'voice-cymatics-comparison');
  assert.ok(Math.abs(data.captures[0].reading.frequencyHz - 220) < 2);
  assert.ok(Math.abs(data.captures[1].reading.frequencyHz - 330) < 2);
  assert.equal(data.captures[0].config.particleSeed, data.captures[1].config.particleSeed);
  assert.equal(content.includes('samples'), false);
  await page.evaluate(() => { window.__voiceProbe.gain.gain.value = 0; });
  await page.getByRole('status').filter({hasText: 'Sin tono estable'}).waitFor();
  assert.equal(await page.getByRole('button', {name: 'Capturar tono vocal A'}).isDisabled(), true);
  assert.equal(await page.getByRole('img', {name: 'Cimática de mi voz en vivo', exact: true}).count(), 0);
  await page.getByRole('button', {name: 'Detener todo', exact: true}).first().click();
  assert.ok(await page.evaluate(() => window.__voiceProbe.tracks.every(track => track.readyState === 'ended')));
});
test('switching to generator stops voice and mobile layout stays within viewport', {timeout: 45000}, async t => {
  const page = await fixture(t, {width: 390, height: 844});
  await page.getByRole('button', {name: 'Conectar mi voz en vivo'}).click(); await pitchNear(page, 220);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole('button', {name: 'Escuchar tono', exact: true}).click();
  await page.getByRole('button', {name: 'Conectar mi voz en vivo'}).waitFor();
  assert.ok(await page.evaluate(() => window.__voiceProbe.tracks.every(track => track.readyState === 'ended')));
  await page.getByRole('button', {name: 'Detener todo', exact: true}).first().click();
});
test('permission denial recovers and pending permission cancellation releases late tracks', {timeout: 45000}, async t => {
  const page = await fixture(t);
  await page.evaluate(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('denied', 'NotAllowedError'); }; });
  await page.getByRole('button', {name: 'Conectar mi voz en vivo'}).click();
  await page.getByRole('alert').filter({hasText: 'No se pudo conectar'}).waitFor();
  await page.evaluate(() => { navigator.mediaDevices.getUserMedia = () => new Promise(resolve => { window.__resolveMic = resolve; }); });
  await page.getByRole('button', {name: 'Conectar mi voz en vivo'}).click();
  await page.getByRole('button', {name: 'Cancelar solicitud de micrófono'}).click();
  await page.evaluate(() => { const audio = new AudioContext(), destination = audio.createMediaStreamDestination(); window.__voiceProbe.tracks = destination.stream.getTracks(); window.__resolveMic(destination.stream); });
  await eventually(async () => assert.ok(await page.evaluate(() => window.__voiceProbe.tracks.every(track => track.readyState === 'ended'))));
  assert.equal(await page.getByRole('button', {name: 'Conectar mi voz en vivo'}).count(), 1);
});
