import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startHarness, observeBrowser, eventually } from './browser-harness.mjs';

const KEY = 'fh:voice-sessions-v1';
let harness;
before(async () => { harness = await startHarness(); }, { timeout: 60000 });
after(async () => { await harness?.close(); }, { timeout: 15000 });
const button = (page, name) => page.getByRole('button', { name, exact: true });
const records = page => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '[]'), KEY);
const probe = page => page.evaluate(() => window.__fhUI.snapshot());

async function openDaily(t, mobile = false) {
  const context = await harness.browser.newContext(mobile ? { viewport: { width: 390, height: 844 } } : {});
  t.after(() => context.close()); await context.addInitScript(observeBrowser);
  await context.addInitScript(() => {
    window.__dailyMicCalls = 0;
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = (...args) => { window.__dailyMicCalls++; return capture(...args); };
  });
  const page = await context.newPage(); page.setDefaultTimeout(8000); page.setDefaultNavigationTimeout(10000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, [], 'No unhandled browser errors'));
  await page.goto(harness.origin + '/inicio');
  await page.getByRole('link', { name: 'Sintonizar mi día', exact: false }).click();
  await button(page, 'Entendido, continuar').click();
  await page.getByRole('heading', { name: 'Sintonizar mi día', exact: true }).waitFor();
  return page;
}
async function prepare(page, goal = 'clarity') {
  const contextsBefore = (await probe(page)).contexts.length;
  await page.getByRole('combobox', { name: '¿Qué quieres practicar?', exact: true }).selectOption(goal);
  await page.getByRole('textbox', { name: 'Mi intención para hoy', exact: true }).fill('Quiero escuchar antes de responder.');
  await button(page, 'Revisar mi intención').click();
  await page.getByText('Cambiar interpretación', { exact: true }).click();
  assert.equal(await page.getByRole('spinbutton', { name: 'Duración (minutos)', exact: true }).inputValue(), '5');
  await button(page, 'Generar recomendación').click();
  await button(page, 'Continuar').click();
  assert.equal((await probe(page)).contexts.length, contextsBefore);
  assert.equal(await page.evaluate(() => window.__dailyMicCalls), 0);
  assert.deepEqual(await records(page), []);
}
async function playAndStop(page) {
  await button(page, 'Iniciar sesión').click();
  await page.getByRole('heading', { name: 'Sesión en curso', exact: true }).waitFor();
  await button(page, 'Detener sesión').click();
  await page.getByRole('heading', { name: '¿Cómo te sentiste?', exact: true }).waitFor();
  await eventually(async () => {
    const data = await probe(page); assert.ok(data.contexts.length > 0);
    for (const context of data.contexts) assert.equal(context.state, 'closed');
  });
}

test('daily text flow saves action atomically, reloads, follows up, exports and deletes', { timeout: 60000 }, async t => {
  const page = await openDaily(t, true); await prepare(page); await playAndStop(page);
  await page.getByRole('textbox', { name: /¿Qué harás hoy para llevarlo a tu vida/ }).fill('Escribir tres preguntas antes de responder.');
  assert.deepEqual(await records(page), []);
  await button(page, 'Guardar sesión').click();
  await page.getByRole('heading', { name: 'Sesión guardada', exact: true }).waitFor();
  const original = (await records(page))[0]; assert.equal(original.dailyAction.revisions.length, 1);
  assert.equal(original.dailyAction.revisions[0].status, 'pending'); assert.deepEqual(original.before, {}); assert.deepEqual(original.after, {});
  assert.equal((await probe(page)).writes.filter(row => row.key === KEY).length, 1);
  await page.getByRole('link', { name: 'Volver al inicio', exact: true }).click();
  await page.getByRole('heading', { name: 'Resonance Lab', exact: true }).waitFor();
  await page.reload(); await button(page, 'La hice').click();
  await page.getByRole('status').filter({ hasText: 'Estado: Hecha' }).waitFor();
  await button(page, 'Sigue pendiente').click();
  await page.getByRole('status').filter({ hasText: 'Estado: Pendiente' }).waitFor();
  await button(page, 'Quiero cambiarla').click();
  await page.getByRole('textbox', { name: 'Cambiar mi acción', exact: true }).fill('Escuchar una respuesta completa.');
  await button(page, 'Guardar cambio').click();
  await page.getByRole('heading', { name: 'Escuchar una respuesta completa.', exact: true }).waitFor();
  const updated = (await records(page))[0]; assert.equal(updated.dailyAction.revisions.length, 4);
  assert.deepEqual(updated.dailyAction.revisions[0], original.dailyAction.revisions[0]);
  for (const field of ['intent', 'proposal', 'before', 'after', 'technical']) assert.deepEqual(updated[field], original[field]);
  assert.equal((await probe(page)).contexts.length, 0); assert.equal(await page.evaluate(() => window.__dailyMicCalls), 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile has no horizontal overflow');
  await page.goto(harness.origin + '/voz'); await page.getByText('Historial de sesiones', { exact: true }).click();
  const download = page.waitForEvent('download'); await button(page, 'Exportar sesiones visibles').click();
  const stream = await (await download).createReadStream(); let json = ''; for await (const chunk of stream) json += chunk;
  assert.deepEqual(JSON.parse(json)[0].dailyAction, updated.dailyAction);
  await button(page, 'Borrar esta sesión').click(); await button(page, 'Confirmar borrado').click();
  await eventually(async () => assert.deepEqual(await records(page), []));
});

test('daily optional action and ratings can be omitted and discard persists no session', { timeout: 45000 }, async t => {
  const page = await openDaily(t); await prepare(page, 'relaxation'); await playAndStop(page);
  await page.getByRole('textbox', { name: /¿Qué harás hoy para llevarlo a tu vida/ }).fill('Esta acción será descartada.');
  await button(page, 'Terminar sin guardar').click(); assert.deepEqual(await records(page), []);
  await prepare(page, 'focus'); await playAndStop(page); await button(page, 'Guardar sesión').click();
  await page.getByRole('heading', { name: 'Sesión guardada', exact: true }).waitFor();
  assert.equal((await records(page))[0].dailyAction, undefined);
});

test('whitespace intention is recoverable without playback or an unhandled rejection', { timeout: 30000 }, async t => {
  const page = await openDaily(t);
  await page.getByRole('textbox', { name: 'Mi intención para hoy', exact: true }).fill('   ');
  await button(page, 'Revisar mi intención').click(); await page.getByRole('alert').filter({ hasText: 'Texto: máximo 500 caracteres.' }).waitFor();
  await prepare(page); assert.equal((await probe(page)).contexts.length, 0);
});
