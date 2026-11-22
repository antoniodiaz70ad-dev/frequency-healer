import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { startLocalServer } from '../scripts/local-test-server.mjs';

test('intention-to-action: draft, native playback, optional visual, review and later dated follow-up', { timeout: 90000 }, async () => {
  const server = await startLocalServer(false);
  let browser;
  try { browser = await chromium.launch({ headless: true, args: ['--mute-audio'], ...(process.env.FH_UI_BROWSER_PATH ? { executablePath: process.env.FH_UI_BROWSER_PATH } : process.env.FH_UI_BROWSER === 'chromium' ? {} : { channel: 'chrome' }) }); }
  catch (error) { await server.close(); throw error; }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(server.origin + '/marina-punto-cero/compositor');
    await page.getByRole('button', { name: 'Preparar práctica de 8 minutos', exact: true }).click();
    assert.deepEqual(await page.getByRole('spinbutton', { name: /^Portadora de capa/ }).evaluateAll(inputs => inputs.map(input => Number(input.value))), [259.2, 324, 388.8]);
    assert.equal(await page.getByLabel('Concentración antes de escuchar', { exact: true }).inputValue(), '');
    assert.equal(await page.getByRole('button', { name: 'Escuchar mi práctica', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: 'Escuchar composición', exact: true }).click();
    await page.getByText(/Completa tu meta, resultado, obstáculo/).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Pausar composición', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Guardar plan y receta', exact: true }).click();
    await page.reload();
    await page.getByRole('button', { name: 'Cargar Intención y acción · 8 minutos', exact: true }).click();
    const fields = {
      '1 · Mi meta': 'Completar un borrador',
      '2 · El resultado que imagino': 'Tres puntos claros para revisar',
      '3 · Mi principal obstáculo interno': 'Seguir buscando datos',
      '4 · Si ocurre…': 'falta un dato',
      'Entonces haré…': 'lo marco por confirmar y continúo',
      'Mi primera acción de 10 minutos': 'Redactar los tres puntos',
      'Cuándo la haré': 'Después de escuchar',
    };
    for (const [label, value] of Object.entries(fields)) await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByLabel('Concentración antes de escuchar', { exact: true }).selectOption('4');
    await page.getByRole('button', { name: 'Guardar plan y receta', exact: true }).click();
    await page.getByRole('button', { name: 'Escuchar mi práctica', exact: true }).click();
    await page.getByRole('button', { name: 'Pausar composición', exact: true }).waitFor();
    await page.getByRole('heading', { name: 'Estabiliza', exact: true }).waitFor();
    assert.equal(await page.getByLabel('1 · Mi meta', { exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: 'Ocultar visual', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Pausar composición', exact: true }).count(), 1);
    assert.equal(await page.evaluate(() => navigator.mediaSession.playbackState), 'playing');
    await page.getByRole('button', { name: 'Pausar composición', exact: true }).click();
    const paused = await page.getByLabel('Avance del compositor', { exact: true }).getAttribute('value');
    await page.waitForTimeout(150);
    assert.equal(await page.getByLabel('Avance del compositor', { exact: true }).getAttribute('value'), paused);
    await page.getByRole('button', { name: 'Reanudar composición', exact: true }).click();
    await page.getByRole('button', { name: 'Pausar composición', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Detener composición', exact: true }).click();
    await page.getByLabel('Concentración después de escuchar', { exact: true }).selectOption('7');
    await page.getByLabel('Distracciones que observé', { exact: true }).fill('2');
    await page.getByLabel('Lo que observé', { exact: true }).fill('Ahora tengo un siguiente paso claro');
    await page.getByRole('button', { name: 'Guardar experiencia del compositor', exact: true }).click();
    let [row] = await page.evaluate(() => JSON.parse(localStorage.getItem('fh.marina.composer-sessions.v1')));
    assert.equal(row.practiceReview.focusBefore, 4);
    assert.equal(row.practiceReview.focusAfter, 7);
    assert.equal(row.practiceReview.actionStatus, 'pending');
    assert.equal(row.recipe.actionPlan.goal, fields['1 · Mi meta']);
    assert.equal(await page.getByLabel('Concentración antes de escuchar', { exact: true }).inputValue(), '');
    await page.locator('summary').filter({ hasText: /^Intención y acción · 8 minutos ·/ }).click();
    await page.getByText('Añadir seguimiento de mi acción', { exact: true }).click();
    await page.getByLabel('Mi avance concreto', { exact: true }).fill('Escribí los tres puntos y guardé el borrador');
    await page.getByRole('button', { name: 'Guardar seguimiento', exact: true }).click();
    await page.getByText('Seguimiento añadido. Tu observación inicial se conserva.', { exact: true }).waitFor();
    await page.reload();
    [row] = await page.evaluate(() => JSON.parse(localStorage.getItem('fh.marina.composer-sessions.v1')));
    assert.equal(row.experience, 'Ahora tengo un siguiente paso claro');
    assert.equal(row.practiceReview.distractions, 2);
    assert.equal(row.practiceReview.actionStatus, 'pending');
    assert.equal(row.actionFollowUps.length, 1);
    assert.equal(row.actionFollowUps[0].actionStatus, 'done');
    assert.equal(row.actionFollowUps[0].evidence, 'Escribí los tres puntos y guardé el borrador');
    assert.ok(Number.isFinite(Date.parse(row.actionFollowUps[0].recordedAt)));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    assert.deepEqual(errors, []);
  } finally { await context.close(); await browser.close(); await server.close(); }
});
