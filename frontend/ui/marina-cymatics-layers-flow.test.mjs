import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { startLocalServer } from '../scripts/local-test-server.mjs';

test('mobile composer: unlock layers without losing the session and render the actual channel mixture', { timeout: 90000 }, async () => {
  const server = await startLocalServer(false);
  let browser;
  try { browser = await chromium.launch({ headless: true, args: ['--mute-audio'], ...(process.env.FH_UI_BROWSER_PATH ? { executablePath: process.env.FH_UI_BROWSER_PATH } : process.env.FH_UI_BROWSER === 'chromium' ? {} : { channel: 'chrome' }) }); }
  catch (error) { await server.close(); throw error; }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const spectrum = page.getByTestId('composer-cymatics-spectrum');
  const edit = page.getByRole('button', { name: 'Guardar tramo y editar capas', exact: true });
  try {
    await page.goto(server.origin + '/marina-punto-cero/compositor');
    await spectrum.filter({ hasText: /192.5 · 200 · 207.5 Hz/ }).waitFor();
    const firstImage = await page.getByRole('img', { name: /^Cimática ·/ }).evaluate(canvas => canvas.toDataURL());
    const picker=page.getByRole('group',{name:'Color de la figura'});
    await picker.getByText('Ámbar',{exact:true}).click();
    assert.notEqual(await page.getByRole('img',{name:/^Cimática ·/}).evaluate(canvas=>canvas.toDataURL()),firstImage);
    await picker.getByText('Original',{exact:true}).click();
    assert.equal(await page.getByRole('img',{name:/^Cimática ·/}).evaluate(canvas=>canvas.toDataURL()),firstImage);
    await page.getByLabel('Activar capa 2', { exact: true }).check();
    await spectrum.filter({ hasText: /207.5 · 300 Hz/ }).waitFor();
    assert.notEqual(await page.getByRole('img', { name: /^Cimática ·/ }).evaluate(canvas => canvas.toDataURL()), firstImage);
    await page.getByLabel('Activar capa 3', { exact: true }).check();
    await page.getByLabel('Canal de la simulación', { exact: true }).selectOption('right');
    await spectrum.filter({ hasText: /192.5 · 200 · 207.5 · 227 · 300 Hz/ }).waitFor();
    await page.getByRole('button', { name: 'Aplicar capas y escuchar', exact: true }).click();
    await page.getByRole('button', { name: 'Pausar composición', exact: true }).waitFor();
    assert.equal(await page.getByLabel('Activar capa 2', { exact: true }).isDisabled(), true);
    await page.waitForTimeout(250);
    await edit.click();
    assert.equal(await page.getByLabel('Activar capa 2', { exact: true }).isEnabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Pausar composición', exact: true }).count(), 0);
    let rows = await page.evaluate(() => JSON.parse(localStorage.getItem('fh.marina.composer-sessions.v1')));
    assert.equal(rows.length, 1); assert.ok(rows[0].elapsedMs > 0); assert.equal(rows[0].recipe.layers[1].enabled, true);
    await page.getByLabel('Activar capa 2', { exact: true }).uncheck();
    await page.getByLabel('Modulación de capa 1 (Hz)', { exact: true }).fill('0.32789');
    await spectrum.filter({ hasText: /199.67211 · 200 · 200.32789 · 227 Hz/ }).waitFor();
    await page.getByRole('button', { name: 'Aplicar capas y escuchar', exact: true }).click();
    await page.getByRole('button', { name: 'Pausar composición', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Ocultar visual', exact: true }).click();
    assert.equal(await page.getByRole('region', { name: 'Cimática del compositor' }).count(), 0);
    assert.equal(await page.evaluate(() => navigator.mediaSession.playbackState), 'playing');
    await page.getByRole('button', { name: 'Detener composición', exact: true }).click();
    await page.getByLabel('Lo que observé', { exact: true }).fill('Conservar antes de editar');
    await edit.click();
    rows = await page.evaluate(() => JSON.parse(localStorage.getItem('fh.marina.composer-sessions.v1')));
    assert.equal(rows.length, 2); assert.equal(rows[1].experience, 'Conservar antes de editar');
    assert.equal(rows[1].recipe.layers[0].rateHz, .32789); assert.equal(rows[1].recipe.layers[1].enabled, false);
    assert.equal(rows[0].recipe.layers[0].rateHz, 7.5);
    await page.getByRole('button', { name: 'Mostrar visual', exact: true }).click();
    await page.getByLabel('Portadora de capa 1 (Hz)', { exact: true }).fill('2500');
    await page.getByText(/esta vista no la simula parcialmente/).waitFor();
    assert.equal(await page.getByRole('img', { name: /^Cimática ·/ }).count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    assert.deepEqual(errors, []);
  } finally { await context.close(); await browser.close(); await server.close(); }
});

test('edit shortcut preserves a paused snapshot when storage refuses the write', { timeout: 60000 }, async () => {
  const server = await startLocalServer(false);
  let browser;
  try { browser = await chromium.launch({ headless: true, args: ['--mute-audio'], ...(process.env.FH_UI_BROWSER_PATH ? { executablePath: process.env.FH_UI_BROWSER_PATH } : process.env.FH_UI_BROWSER === 'chromium' ? {} : { channel: 'chrome' }) }); }
  catch (error) { await server.close(); throw error; }
  const context = await browser.newContext(), page = await context.newPage();
  try {
    await page.goto(server.origin + '/marina-punto-cero/compositor');
    await page.getByRole('button', { name: 'Escuchar composición', exact: true }).click();
    await page.getByRole('button', { name: 'Pausar composición', exact: true }).click();
    await page.evaluate(() => { window.originalSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('Storage full', 'QuotaExceededError'); }; });
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Guardar tramo y editar capas', exact: true }).click();
    await download;
    await page.getByRole('alert').filter({ hasText: /Conservamos esta sesión/ }).waitFor();
    assert.equal(await page.getByLabel('Activar capa 2', { exact: true }).isDisabled(), true);
    await page.evaluate(() => { Storage.prototype.setItem = window.originalSetItem; });
    await page.getByRole('button', { name: 'Guardar tramo y editar capas', exact: true }).click();
    assert.equal(await page.getByLabel('Activar capa 2', { exact: true }).isEnabled(), true);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('fh.marina.composer-sessions.v1')).length), 1);
  } finally { await context.close(); await browser.close(); await server.close(); }
});
