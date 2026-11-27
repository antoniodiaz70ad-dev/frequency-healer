import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { startLocalServer } from '../scripts/local-test-server.mjs';

test('Arthur: real MP3 decoding, native scheduling, pause/resume and explicit load failure', { timeout: 60000 }, async () => {
  const server = await startLocalServer(false);
  let browser;
  try {
    browser = await chromium.launch({ headless: true, timeout: 15000, ...(process.env.FH_UI_BROWSER_PATH ? { executablePath: process.env.FH_UI_BROWSER_PATH } : process.env.FH_UI_BROWSER === 'chromium' ? {} : { channel: 'chrome' }), args: ['--no-sandbox', '--mute-audio'] });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => {
      window.__arthurStarts = []; window.__arthurStops = 0; window.__speechCount = 0;
      window.speechSynthesis.speak = () => { window.__speechCount++; };
      const create = AudioContext.prototype.createBufferSource;
      AudioContext.prototype.createBufferSource = function () {
        const source = create.call(this), start = source.start.bind(source), stop = source.stop.bind(source);
        source.start = (...args) => { window.__arthurStarts.push(args); return start(...args); };
        source.stop = (...args) => { window.__arthurStops++; return stop(...args); };
        return source;
      };
    });
    const page = await context.newPage(); page.setDefaultTimeout(8000);
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.url().includes('/audio/arthur-es-v1/')) requests.push(request.url()); });
    async function prepare(target) {
      await target.goto(server.origin + '/preparacion-cristales');
      await target.getByLabel('Nombre de mi cristal').fill('Cuarzo de prueba');
      await target.getByRole('combobox', { name: 'Recorrido', exact: true }).selectOption('10');
      await target.getByRole('button', { name: 'Usar frase de partida' }).click();
      await target.getByRole('button', { name: 'Revisar sonido y comenzar' }).click();
      assert.equal(await target.getByLabel('Voz de la guía', { exact: true }).inputValue(), 'arthur');
      await target.getByLabel('Leer instrucciones con voz', { exact: true }).check();
    }
    await prepare(page);
    await page.getByRole('button', { name: 'Comenzar preparación' }).click();
    await page.getByRole('button', { name: 'Pausar', exact: true }).waitFor();
    assert.equal(requests.length, 5);
    assert.ok(requests.every(url => url.startsWith(server.origin + '/audio/arthur-es-v1/')));
    const starts = await page.evaluate(() => window.__arthurStarts);
    assert.equal(starts.length, 5);
    assert.ok(starts.every(args => args[1] === 0 && args[2] > 1));
    assert.equal(Math.round(starts[1][0] - starts[0][0]), 120);
    assert.equal(Math.round(starts[2][0] - starts[0][0]), 180);
    assert.equal(Math.round(starts[3][0] - starts[0][0]), 420);
    assert.equal(Math.round(starts[4][0] - starts[0][0]), 540);
    assert.equal(await page.evaluate(() => window.__speechCount), 0);
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: 'Pausar', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__arthurStops), 5);
    await page.getByRole('button', { name: 'Reanudar', exact: true }).click();
    await page.getByRole('button', { name: 'Pausar', exact: true }).waitFor();
    const resumed = await page.evaluate(() => window.__arthurStarts.slice(5));
    assert.equal(resumed.length, 5); assert.ok(resumed[0][1] > 0);
    await page.getByRole('button', { name: 'Detener', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__arthurStops), 10);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    assert.deepEqual(errors, []);

    const failed = await context.newPage();
    await failed.route('**/audio/arthur-es-v1/**', route => route.fulfill({ status: 404, body: '' }));
    await prepare(failed);
    await failed.getByRole('button', { name: 'Comenzar preparación' }).click();
    await failed.getByText('No se pudo cargar Arthur. Reintenta o elige la voz del dispositivo.', { exact: true }).waitFor();
    assert.equal(await failed.evaluate(() => window.__speechCount), 0);
    assert.equal(await failed.evaluate(() => window.__arthurStarts.length), 0);
    assert.equal(await failed.getByRole('button', { name: 'Pausar', exact: true }).count(), 0);
    const marina = await context.newPage();
    await marina.goto(server.origin + '/marina-punto-cero');
    await marina.getByLabel('Leer instrucciones con voz', { exact: true }).check();
    await marina.getByRole('button', { name: 'Comenzar 24 minutos', exact: true }).click();
    await marina.getByRole('button', { name: 'Pausar', exact: true }).waitFor();
    const marinaStarts = await marina.evaluate(() => window.__arthurStarts);
    assert.equal(marinaStarts.length, 4);
    assert.deepEqual(marinaStarts.map(args => Math.round(args[0] - marinaStarts[0][0])), [0, 240, 420, 900]);
    await marina.getByRole('button', { name: 'Detener', exact: true }).click();
    assert.equal(await marina.evaluate(() => window.__arthurStops), 4);
    await context.close();
  } finally { await browser?.close(); await server.close(); }
});
