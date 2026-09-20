import { before, after, test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { startHarness, observeBrowser, eventually } from './browser-harness.mjs';

import { mkdir, writeFile } from 'node:fs/promises';
const pages = new WeakMap();
const test = (name, run) => nodeTest(name, { timeout: 45000 }, async t => {
  try { await run(t); } catch (error) {
    const page = pages.get(t), directory = process.env.FH_UI_ARTIFACTS_DIR;
    if (directory) {
      const stem = name.replace(/[^a-zA-Z0-9-]/g, '_');
      try {
        await mkdir(directory, { recursive: true });
        await writeFile(`${directory}/${stem}.log`, String(error.stack ?? error));
        if (page && !page.isClosed()) await page.screenshot({ path: `${directory}/${stem}.png`, timeout: 5000 });
      } catch (captureError) { console.error('Failure artifact capture:', captureError.message); }
    }
    throw error;
  }
});
const KEY = 'fh:experiment-sessions-v1';
let harness;
before(async () => { harness = await startHarness(); }, { timeout: 60000 });
after(async () => { await harness?.close(); }, { timeout: 15000 });
const button = (page, name) => page.getByRole('button', { name, exact: true });
const field = (page, name) => page.getByRole('spinbutton', { name, exact: true });
const ratio = page => page.getByRole('combobox', { name: 'Relación', exact: true });
const mode = page => page.getByRole('combobox', { name: 'Modo', exact: true });
const probe = page => page.evaluate(() => window.__fhUI.snapshot());
const storage = page => page.evaluate(() => ({ ...localStorage }));
async function fixture(t) {
  const context = await harness.browser.newContext();
  t.after(() => context.close());
  await context.addInitScript(observeBrowser);
  const page = await context.newPage(); pages.set(t, page); page.setDefaultTimeout(8000); page.setDefaultNavigationTimeout(10000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, [], 'No uncaught browser errors'));
  await page.goto(harness.origin + '/laboratorio-armonico');
  await field(page, 'Base (Hz)').fill('432');
  await field(page, 'Volumen (0–100)').fill('0');
  await field(page, 'Duración (minutos)').fill('1');
  return page;
}
async function controls(page) {
  return { baseHz: Number(await field(page,'Base (Hz)').inputValue()), ratioId: await ratio(page).inputValue(),
    mode: await mode(page).inputValue(), durationSeconds: Number(await field(page,'Duración (minutos)').inputValue()) * 60,
    uiVolume: Number(await field(page,'Volumen (0–100)').inputValue()) };
}
async function open(page) {
  await page.getByText('Explorador armónico · explorar y aplicar', { exact: true }).click();
  await page.getByRole('table', { name: 'Ratios exploratorios · disponibilidad V1', exact: true }).waitFor();
}
async function noPlayback(page) {
  await eventually(async () => assert.equal(await page.getByRole('status').filter({ hasText: /^Audio detenido$/ }).count(),1));
  assert.equal((await probe(page)).contexts.length,0, 'No AudioContext before explicit confirm');
  assert.deepEqual(await storage(page),{}, 'No automatic storage');
  assert.deepEqual((await probe(page)).writes,[]);
}
async function selectRatio(page, name) {
  await button(page, `Seleccionar ${name}`).click();
  await page.getByRole('region', { name: 'Vista previa del cambio', exact: true }).waitFor();
}
async function applyRatio(page, name) { await selectRatio(page,name); await button(page,'Aplicar a controles').click(); }
async function applyOctave(page, offset) { await button(page,`Seleccionar octava ${offset}`).click(); await button(page,'Aplicar a semilla').click(); }
async function start(page) {
  await button(page,'Confirmar e iniciar').click();
  await eventually(async () => assert.equal(await page.getByRole('status').filter({ hasText: /^Audio en curso$/ }).count(),1));
}
async function clean(page) {
  await eventually(async () => {
    const { contexts } = await probe(page);
    assert.ok(contexts.length > 0, 'Audio actually constructed');
    for (const ctx of contexts) {
      assert.equal(ctx.state,'closed');
      for (const osc of ctx.oscillators) { assert.ok(osc.ended); assert.ok(osc.disconnected); assert.ok(osc.stops.length >= 2, 'Explicit stop replaced scheduled ending'); }
    }
  });
}
async function stop(page) { await button(page,'Detener sesión').click(); await clean(page); }
async function graph(page, expected, simultaneous = false) {
  const data = await probe(page); const oscillators = data.contexts.flatMap(c => c.oscillators);
  assert.deepEqual(oscillators.map(o => o.frequencies),expected.map(hz => [hz]));
  assert.ok(oscillators.every(o => o.waveform === 'sine'));
  const origin = oscillators[0].starts[0];
  oscillators.forEach((o,i) => {
    assert.ok(Math.abs(o.starts[0] - origin - (simultaneous ? 0 : i*60/expected.length)) < 1e-8);
    assert.ok(Math.abs(o.stops[0] - o.starts[0] - (simultaneous ? 60 : 60/expected.length)) < 1e-8);
  });
}

for (const [name,id,hz] of [['1:1','root',432],['3:2','fifth',648],['4:3','fourth',576],['5:4','major-third',540],['6:5','minor-third',518.4]]) {
  test(`ratio ${name}: select ≠ apply ≠ play; native audio and stop cleanup`, async t => {
    const page = await fixture(t); await ratio(page).selectOption(id === 'fourth' ? 'fifth' : 'fourth');
    const before = await controls(page); await open(page); await selectRatio(page,name);
    assert.deepEqual(await controls(page),before); await noPlayback(page);
    await button(page,'Aplicar a controles').click();
    assert.deepEqual(await controls(page),{ ...before,ratioId:id }); await noPlayback(page);
    await start(page); await graph(page,[432,hz]);
    assert.ok(await button(page,`Seleccionar ${name}`).isDisabled());
    await stop(page); assert.deepEqual(await storage(page),{});
  });
}
for (const name of ['5:3','2:1']) test(`unsupported ${name}: visible, exploration-only, cannot apply`, async t => {
  const page = await fixture(t); const before = await controls(page); await open(page);
  const row = page.getByRole('row').filter({ has: page.getByRole('rowheader').filter({ hasText: new RegExp(`^${name}.*Solo exploración$`) }) });
  assert.equal(await row.count(),1); assert.match(await row.innerText(),/Sin aplicar/);
  assert.equal(await row.getByRole('button').count(),0);
  assert.equal(await button(page,'Aplicar a controles').count(),0);
  assert.deepEqual(await controls(page),before); await noPlayback(page);
});
for (const playbackMode of ['sequence','simultaneous']) test(`octave ${playbackMode}: preview, seed-only Apply, confirm and stop`, async t => {
  const page = await fixture(t); await mode(page).selectOption(playbackMode);
  const before = await controls(page); await open(page);
  await button(page,'Seleccionar octava +1').click();
  await page.getByRole('heading',{name:'Vista previa de octava · todavía sin aplicar',exact:true}).waitFor();
  assert.match(await page.getByRole('row').filter({has: page.getByRole('cell', {name:'Semilla: 432 Hz', exact:true})}).innerText(),/864 Hz/);
  assert.deepEqual(await controls(page),before); await noPlayback(page);
  await button(page,'Aplicar a semilla').click(); assert.deepEqual(await controls(page),{...before,baseHz:864}); await noPlayback(page);
  await start(page); await graph(page,[864,1296],playbackMode==='simultaneous');
  assert.ok(await button(page,'Seleccionar octava -1').isDisabled()); await stop(page);
});

test('invalid octaves: omitted bounds and valid seed with invalid derived frequency never correct controls', async t => {
  const page = await fixture(t); await open(page);
  assert.equal(await button(page,'Seleccionar octava -4').count(),0); assert.equal(await button(page,'Seleccionar octava +3').count(),0);
  const before = await controls(page); await button(page,'Seleccionar octava +2').click();
  await page.getByRole('alert').filter({hasText:'No se puede aplicar a la sesión actual'}).waitFor();
  assert.equal(await button(page,'Aplicar a semilla').count(),0); assert.deepEqual(await controls(page),before);
  await ratio(page).selectOption('root');
  for (const [seed, omitted] of [['40','-1'],['2000','+1']]) {
    await field(page,'Base (Hz)').fill(seed); assert.equal(await button(page,`Seleccionar octava ${omitted}`).count(),0);
    await applyOctave(page,'0'); assert.equal(await field(page,'Base (Hz)').inputValue(),seed);
  }
  await noPlayback(page);
});

test('stale selections and cancellation do not mutate form or start playback', async t => {
  const page = await fixture(t); await open(page); const before = await controls(page);
  await selectRatio(page,'6:5'); await button(page,'Cancelar selección').click();
  await button(page,'Seleccionar octava +1').click(); await button(page,'Cancelar selección de octava').click();
  assert.deepEqual(await controls(page),before);
  await selectRatio(page,'6:5'); await button(page,'Seleccionar octava +1').click();
  await field(page,'Base (Hz)').fill('440');
  assert.equal(await button(page,'Aplicar a controles').count(),0); assert.equal(await button(page,'Aplicar a semilla').count(),0);
  assert.equal(await field(page,'Base (Hz)').inputValue(),'440'); await noPlayback(page);
});

for (const order of ['ratio-first','octave-first']) test(`composition ${order}: same final V1 configuration and frequencies`, async t => {
  const page = await fixture(t); await open(page);
  if (order === 'ratio-first') { await applyRatio(page,'6:5'); await applyOctave(page,'+1'); }
  else { await applyOctave(page,'+1'); await applyRatio(page,'6:5'); }
  assert.deepEqual(await controls(page),{baseHz:864,ratioId:'minor-third',mode:'sequence',durationSeconds:60,uiVolume:0});
  await noPlayback(page); await start(page); await graph(page,[864,1036.8]); await stop(page);
});

test('experiment: exact final immutable snapshot, missing ratings, explicit save and reload', async t => {
  const page = await fixture(t);
  await page.getByRole('checkbox',{name:'Registrar la próxima sesión',exact:true}).check();
  await page.getByRole('textbox',{name:'Intención (opcional)',exact:true}).fill('Prueba UI sintética');
  await page.getByRole('combobox',{name:'Expectativa de una experiencia útil (opcional, 0–10)',exact:true}).selectOption('0');
  await page.getByRole('combobox',{name:'Antes: Claridad',exact:true}).selectOption('0');
  await open(page); await applyRatio(page,'6:5'); await applyOctave(page,'+1'); await noPlayback(page);
  await start(page); assert.deepEqual(await storage(page),{}); await stop(page);
  await page.getByRole('status').filter({hasText:'Experimento: Cancelado por ti · Sin guardar'}).waitFor();
  await page.getByRole('combobox',{name:'Después: Energía',exact:true}).selectOption('7');
  await page.getByRole('textbox',{name:'Reflexión (opcional)',exact:true}).fill('Datos de prueba, sin evaluación real.');
  // Later manual edits must NOT rewrite the already-confirmed snapshot.
  await field(page,'Base (Hz)').fill('440'); assert.deepEqual(await storage(page),{});
  assert.deepEqual((await probe(page)).writes,[]);
  await button(page,'Guardar experimento').click(); await button(page,'Experimento guardado').waitFor();
  const stored = await storage(page); assert.deepEqual(Object.keys(stored),[KEY]);
  const [record] = JSON.parse(stored[KEY]); assert.equal(JSON.parse(stored[KEY]).length,1);
  assert.deepEqual(record.configurationSnapshot,{baseHz:864,ratioId:'minor-third',increments:3,direction:'ascending',mode:'sequence',durationSeconds:60,uiVolume:0,waveform:'sine'});
  assert.equal(Object.hasOwn(record.configurationSnapshot,'progression'),false);
  assert.equal(record.status,'cancelled'); assert.equal(record.completedAt,undefined);
  assert.equal(record.intention,'Prueba UI sintética'); assert.equal(record.expectationScore,0);
  assert.deepEqual(record.preState,{clarity:0}); assert.deepEqual(record.postState,{energy:7});
  assert.equal(record.reflection,'Datos de prueba, sin evaluación real.');
  assert.equal((await probe(page)).writes.length,1);
  await page.reload(); await page.getByText('Experimentos guardados (1)',{exact:true}).waitFor();
  assert.deepEqual(await storage(page),stored);
  const rendered = await page.locator('pre').allTextContents(); assert.ok(rendered.some(value=>JSON.stringify(JSON.parse(value))===JSON.stringify(record)));
});

test('navigation during audio: closes native graph, never completed, never autosaved', async t => {
  const page = await fixture(t); await page.getByRole('checkbox',{name:'Registrar la próxima sesión',exact:true}).check();
  await start(page); await page.getByRole('status').filter({hasText:'Experimento: En curso'}).waitFor();
  await page.getByRole('link',{name:'⚡ Dashboard',exact:true}).click(); await page.waitForURL(harness.origin + '/');
  await clean(page); const data = await probe(page);
  assert.ok(data.statuses.some(s=>s.includes('En curso'))); assert.ok(data.statuses.every(s=>!s.includes('Completado')));
  assert.deepEqual(data.writes,[]); assert.deepEqual(await storage(page),{});
  await page.getByRole('complementary').getByRole('link',{name:'∿ Laboratorio Armónico',exact:true}).click();
  await page.getByText('Experimentos guardados (0)',{exact:true}).waitFor();
  assert.equal(await page.getByRole('status').filter({hasText:'Experimento:'}).count(),0);
  assert.deepEqual(await storage(page),{});
});

for (const direction of ['ascending','descending','return']) test(`cascade ${direction}: existing consent, schedule and cleanup unchanged`, async t => {
  const page = await fixture(t); await ratio(page).selectOption('cascade-13-12');
  await page.getByRole('combobox',{name:'Trayectoria',exact:true}).selectOption(direction);
  await open(page); await page.getByRole('status').filter({hasText:'La cascada 13/12 no se adapta'}).waitFor();
  assert.ok(await button(page,'Seleccionar 3:2').isDisabled());
  assert.ok(await button(page,'Confirmar e iniciar').isDisabled());
  await page.getByRole('checkbox',{name:'Acepto la exploración experimental 13/12, sin promesas de resultados.',exact:true}).check();
  await start(page);
  const exponents = direction==='descending' ? [0,-1,-2,-3] : direction==='return' ? [0,1,2,3,2,1,0] : [0,1,2,3];
  await graph(page,exponents.map(k=>432*(13/12)**k)); await stop(page); assert.deepEqual(await storage(page),{});
});
