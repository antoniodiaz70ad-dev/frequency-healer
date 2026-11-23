import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { startLocalServer } from '../scripts/local-test-server.mjs';

test('Marina: legacy diary, local recording, 12-minute flow, phase speech and dated follow-ups', { timeout: 90000 }, async () => {
  const server = await startLocalServer(false);
  let browser;
  try { browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'], ...(process.env.FH_UI_BROWSER_PATH ? { executablePath: process.env.FH_UI_BROWSER_PATH } : process.env.FH_UI_BROWSER === 'chromium' ? {} : { channel: 'chrome' }) }); } catch (error) { await server.close(); throw error; }
  const context = await browser.newContext({ permissions: ['microphone'] });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(server.origin + '/marina-punto-cero');
    await page.getByRole('button', { name: 'Comenzar 24 minutos', exact: true }).waitFor();
    await page.evaluate(() => localStorage.setItem('fh.marina.sessions.v1', JSON.stringify([{ id: 'legacy', version: 'marina-exploration-1', startedAt: '2026-11-20T22:00:00Z', endedAt: '2026-11-20T22:24:00Z', kind: 'guided', status: 'completed', elapsedMs: 1440000, config: { mode: 'pulse', hz: 3, carrierHz: 200 }, soundEnabled: true, notes: { intention: 'Sesión anterior', experience: '', interpretation: '', events: 'Hecho previo', action: '' } }])));
    await page.reload();
    await page.getByRole('button', { name: 'Grabar mi frase', exact: true }).click();
    await page.getByText('Grabando tu frase. Máximo 60 segundos.').waitFor();
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: 'Terminar grabación' }).click();
    await page.getByText('Frase guardada en este navegador.').waitFor();
    await page.locator('audio').waitFor();
    await page.reload();
    await page.locator('audio').waitFor(); // Native IndexedDB Blob survives reload.
    await page.getByLabel('Elegir práctica').selectOption('creation12');
    await page.getByLabel('Mi intención', { exact: true }).fill('Una intención concreta');
    await page.getByLabel('Mi frase', { exact: true }).fill('Presento con claridad');
    await page.getByLabel('La escena que elijo').fill('Una conversación serena');
    await page.getByLabel('El sentimiento que acompaña').fill('Calma');
    await page.getByLabel('Voz de la guía', { exact: true }).selectOption('device');
    await page.getByLabel('Leer instrucciones con voz', { exact: true }).check();
    await page.evaluate(() => {
      window.__speechCount = 0;
      window.speechSynthesis.speak = () => { window.__speechCount++; };
    });
    await page.clock.install();
    await page.getByRole('button', { name: 'Comenzar 12 minutos', exact: true }).click();
    await page.getByRole('button', { name: 'Pausar', exact: true }).waitFor();
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.clock.runFor(1000);
    assert.equal(await page.getByRole('button', { name: 'Pausar', exact: true }).count(), 1, 'hiding the guided practice must not pause it');
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    assert.equal(await page.evaluate(() => window.__speechCount), 1, 'voice must not restart on 200ms render ticks');
    await page.getByRole('button', { name: 'Pausar', exact: true }).click();
    const remaining = await page.getByLabel('Tiempo restante').textContent();
    await page.clock.fastForward(60000);
    assert.equal(await page.getByLabel('Tiempo restante').textContent(), remaining);
    await page.getByRole('button', { name: 'Reanudar', exact: true }).click();
    await page.getByRole('button', { name: 'Pausar', exact: true }).waitFor();
    await page.clock.fastForward(480000);
    await page.waitForFunction(() => document.querySelector('audio')?.paused === false);
    assert.equal(await page.locator('progress').getAttribute('max'), '720000');
    await page.clock.fastForward(240000);
    await page.getByRole('button', { name: 'Guardar sesión', exact: true }).waitFor();
    assert.equal(await page.locator('audio').evaluate(el => el.paused), true);
    await page.getByRole('button', { name: 'Guardar sesión', exact: true }).click();
    await page.getByRole('button', { name: 'Mi diario', exact: true }).click();
    const entry = page.locator('details').first(); await entry.locator('summary').click();
    await entry.getByLabel('Añadir un hecho posterior').fill('Una conversación posterior');
    await entry.getByRole('button', { name: 'Guardar observación con fecha' }).click();
    await entry.getByLabel('Añadir un hecho posterior').fill('Segunda observación');
    await entry.getByRole('button', { name: 'Guardar observación con fecha' }).click();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('fh.marina.sessions.v1')));
    assert.equal(stored.length, 2); assert.equal(stored[0].notes.events, 'Hecho previo');
    assert.equal(stored[1].protocol, 'creation12'); assert.equal(stored[1].status, 'completed');
    assert.equal(stored[1].practice.statement, 'Presento con claridad');
    assert.deepEqual(stored[1].followUps.map(f => f.text), ['Una conversación posterior', 'Segunda observación']);
    assert.ok(stored[1].followUps.every(f => Number.isFinite(Date.parse(f.at))));
    await page.getByRole('button', { name: 'Cuaderno de estudio' }).click();
    await page.getByRole('link', { name: 'Leer página 23 del PDF' }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({ path: '/tmp/marina-study-mobile.png', fullPage: true });
    assert.deepEqual(errors, []);
  } finally { await context.close(); await browser.close(); await server.close(); }
});
