import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { startLocalServer } from '../scripts/local-test-server.mjs';

test('composer: precise recipe persistence, native audio, pause/resume, diary and mobile layout', { timeout: 90000 }, async () => {
  const server = await startLocalServer(false);
  let browser;
  try { browser = await chromium.launch({ executablePath: process.env.FH_UI_BROWSER_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--mute-audio'] }); }
  catch (error) { await server.close(); throw error; }
  const context = await browser.newContext();
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(server.origin + '/marina-punto-cero');
    await page.getByRole('button', { name: 'Compositor', exact: true }).click();
    await page.getByLabel('Nombre de la composición', { exact: true }).fill('Prueba de capas');
    await page.getByLabel('Intención de la composición', { exact: true }).fill('Observar con calma');
    await page.getByLabel('Modulación de capa 1 (Hz)', { exact: true }).fill('0.32789');
    await page.getByLabel('Activar capa 2', { exact: true }).check();
    await page.getByLabel('Activar capa 3', { exact: true }).check();
    await page.getByRole('button', { name: 'Guardar receta', exact: true }).click();
    await page.getByText('Receta guardada en este navegador.', { exact: true }).waitFor();
    await page.reload();
    await page.getByRole('button', { name: 'Compositor', exact: true }).click();
    await page.getByRole('button', { name: 'Cargar Prueba de capas', exact: true }).click();
    assert.equal(await page.getByLabel('Modulación de capa 1 (Hz)', { exact: true }).inputValue(), '0.32789');
    assert.equal(await page.getByLabel('Activar capa 2', { exact: true }).isChecked(), true);
    await page.getByRole('button', { name: 'Escuchar composición', exact: true }).click();
    await page.getByRole('button', { name: 'Pausar composición', exact: true }).waitFor();
    await page.waitForTimeout(1100);
    await page.getByRole('button', { name: 'Pausar composición', exact: true }).click();
    const paused = await page.getByLabel('Avance del compositor', { exact: true }).getAttribute('value');
    assert.ok(Number(paused) > 100);
    await page.waitForTimeout(350);
    assert.equal(await page.getByLabel('Avance del compositor', { exact: true }).getAttribute('value'), paused);
    await page.getByRole('button', { name: 'Reanudar composición', exact: true }).click();
    await page.getByRole('button', { name: 'Pausar composición', exact: true }).waitFor();
    await page.waitForTimeout(350);
    await page.getByRole('button', { name: 'Detener composición', exact: true }).click();
    await page.getByLabel('Lo que observé', { exact: true }).fill('Experiencia de prueba');
    await page.getByRole('button', { name: 'Guardar experiencia del compositor', exact: true }).click();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('fh.marina.composer-sessions.v1')));
    assert.equal(stored.length, 1); assert.equal(stored[0].status, 'stopped');
    assert.equal(stored[0].recipe.layers[0].rateHz, .32789);
    assert.equal(stored[0].recipe.layers.filter(layer => layer.enabled).length, 3);
    assert.ok(stored[0].elapsedMs > Number(paused));
    assert.equal(stored[0].experience, 'Experiencia de prueba');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    assert.deepEqual(errors, []);
  } finally { await context.close(); await browser.close(); await server.close(); }
});
