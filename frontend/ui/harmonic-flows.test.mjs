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
const V2_KEY = 'fh:experiment-sessions-v2';
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
  await page.getByRole('link',{name:'Inicio',exact:true}).click(); await page.waitForURL(harness.origin + '/');
  await clean(page); const data = await probe(page);
  assert.ok(data.statuses.some(s=>s.includes('En curso'))); assert.ok(data.statuses.every(s=>!s.includes('Completado')));
  assert.deepEqual(data.writes,[]); assert.deepEqual(await storage(page),{});
  await page.getByRole('complementary').getByRole('link',{name:'Laboratorio Armónico',exact:true}).click();
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

function readerRecord(status = 'completed', configPatch = {}, optional = true) {
  return {
    id: `reader-${status}`, schemaVersion: 1, source: 'harmonic-lab', status,
    createdAt: '2026-09-19T10:00:00.000Z',
    ...(status === 'prepared' ? {} : { startedAt: '2026-09-19T10:00:01.000Z' }),
    ...(['completed','cancelled','interrupted'].includes(status) ? { endedAt: '2026-09-19T10:01:01.000Z' } : {}),
    ...(status === 'completed' ? { completedAt: '2026-09-19T10:01:01.000Z' } : {}),
    ...(optional ? { intention: 'Lectura histórica sintética', context: 'Prueba local', expectationScore: 0 } : {}),
    configurationSnapshot: { baseHz: 432, ratioId: 'fifth', increments: 3, direction: 'ascending', mode: 'sequence', durationSeconds: 60, uiVolume: 0, waveform: 'sine', ...configPatch },
    preState: optional ? { clarity: 0, tension: 1, focus: 2, energy: 3, mood: 4 } : {},
    postState: optional ? { clarity: 5, tension: 6, focus: 7, energy: 8, mood: 9 } : {},
    ...(optional ? { reflection: 'Reflexión sin interpretación causal.' } : {}),
  };
}
async function historical(t, payload) {
  const page = await fixture(t);
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 3);
  await page.evaluate(({key, raw}) => localStorage.setItem(key, raw), {key:KEY, raw});
  await page.reload();
  await page.getByRole('checkbox',{name:'Registrar la próxima sesión',exact:true}).waitFor();
  return {page, raw};
}
async function reader(page, id) {
  await page.getByText(/^Experimentos guardados \(/).click();
  await page.getByText(/^Ver detalles ·/).click();
  const article = page.getByRole('article',{name:`Experimento guardado ${id}`,exact:true});
  await article.waitFor(); return article;
}
const detail = (scope, label) => scope.locator('dt').filter({hasText:new RegExp(`^${label}$`)}).locator('..').locator('dd');
async function readOnly(page, raw) {
  assert.deepEqual(await storage(page),{[KEY]:raw});
  assert.deepEqual((await probe(page)).writes,[]);
  assert.equal((await probe(page)).contexts.length,0);
}

for (const status of ['prepared','started','completed','cancelled','interrupted']) test(`reader ${status}: exact lifecycle, missing optionals and no writes`, async t => {
  const record = readerRecord(status,{},false); const {page, raw} = await historical(t,[record]);
  const article = await reader(page,record.id);
  assert.equal(await detail(article,'Estado').innerText(),status);
  assert.equal(await detail(article,'ID').innerText(),record.id);
  assert.equal(await detail(article,'Origen').innerText(),'harmonic-lab');
  for (const label of ['Intención','Expectativa','Contexto','Reflexión']) assert.equal(await detail(article,label).innerText(),'Sin registrar');
  for (const section of ['Estado previo','Estado posterior']) for (const label of ['Claridad','Tensión','Enfoque','Energía','Ánimo']) {
    assert.equal(await detail(article.getByRole('region',{name:section,exact:true}),label).innerText(),'Sin registrar');
  }
  for (const [label, value] of [['Creado',record.createdAt],['Iniciado',record.startedAt],['Terminado',record.endedAt],['Completado',record.completedAt]]) {
    if (value === undefined) assert.equal(await detail(article,label).innerText(),'Sin registrar');
    else assert.ok((await detail(article,label).innerText()).includes(value));
  }
  assert.equal(await detail(article,'progression').innerText(),'Sin registrar');
  const summary = article.getByRole('region',{name:'Resumen armónico',exact:true});
  await eventually(async () => assert.match(await detail(summary,'Firma de constelación').innerText(),/^sha256:[a-f0-9]{64}$/));
  assert.match(await summary.getByRole('table').innerText(),/648 Hz/);
  assert.equal(await article.locator('input,select,textarea,button').count(),0);
  await readOnly(page,raw);
  await button(page,'Volver al historial').click(); await eventually(async () => assert.equal(await article.count(),0));
  await readOnly(page,raw);
});

test('reader complete: all stored fields, zeros, explicit progression and unchanged export', async t => {
  const record = readerRecord('completed',{baseHz:432.123456789,ratioId:'fourth',mode:'simultaneous',direction:'return',increments:5,progression:['minor-third','root','fifth']});
  const {page,raw} = await historical(t,[record]); const article = await reader(page,record.id);
  for (const [label,value] of [['Intención',record.intention],['Contexto',record.context],['Reflexión',record.reflection],['Expectativa','0 / 10']]) assert.equal(await detail(article,label).innerText(),value);
  const config = article.getByRole('region',{name:'Configuración guardada',exact:true});
  const expected = {baseHz:'432.123456789 Hz',ratioId:'fourth · Cuarta justa',increments:'5',direction:'return',mode:'simultaneous',durationSeconds:'60 s',uiVolume:'0 / 100',waveform:'sine',progression:'minor-third → root → fifth'};
  for (const [label,value] of Object.entries(expected)) assert.equal(await detail(config,label).innerText(),value);
  for (const [section, values] of [['Estado previo',[0,1,2,3,4]],['Estado posterior',[5,6,7,8,9]]]) {
    for (const [i,label] of ['Claridad','Tensión','Enfoque','Energía','Ánimo'].entries()) assert.equal(await detail(article.getByRole('region',{name:section,exact:true}),label).innerText(),`${values[i]} / 10`);
  }
  const summary = article.getByRole('region',{name:'Resumen armónico',exact:true});
  await eventually(async () => assert.match(await detail(summary,'Firma de constelación').innerText(),/^sha256:[a-f0-9]{64}$/));
  assert.equal(await detail(summary,'Frecuencia semilla').innerText(),'432.123456789 Hz');
  const cells = await summary.locator('tbody tr').allTextContents(); assert.equal(cells.length,3);
  for (const [i, [relationship,hz]] of [['6:5',432.123456789*6/5],['1:1',432.123456789],['3:2',432.123456789*3/2]].entries()) {
    assert.ok(cells[i].includes(relationship)); assert.ok(cells[i].includes(`${hz} Hz`));
  }
  const downloadEvent = page.waitForEvent('download'); await button(page,'Exportar registro guardado').click();
  const download = await downloadEvent; assert.equal(download.suggestedFilename(),`experimento-${record.id}.json`);
  const stream = await download.createReadStream(); let text = ''; for await (const chunk of stream) text += chunk;
  assert.deepEqual(JSON.parse(text),record); await readOnly(page,raw);
});

test('reader cascade: exact stored configuration with unavailable harmonic representation', async t => {
  const record = readerRecord('interrupted',{ratioId:'cascade-13-12'}); const {page,raw} = await historical(t,[record]);
  const article = await reader(page,record.id);
  await article.getByText('La representación detallada de la constelación no está disponible para esta configuración.',{exact:true}).waitFor();
  assert.equal(await detail(article,'ratioId').innerText(),'cascade-13-12 · Cascada experimental');
  assert.equal(await article.getByRole('region',{name:'Resumen armónico',exact:true}).getByRole('table').count(),0);
  await readOnly(page,raw);
});

for (const payload of ['{broken json', JSON.stringify([{...readerRecord(),schemaVersion:99}])]) test(`reader invalid storage (${payload.startsWith('{')?'JSON':'schema'}): no repair or rendering`, async t => {
  const {page,raw} = await historical(t,payload);
  await page.getByRole('alert').filter({hasText:'Historial de experimentos inválido'}).waitFor();
  assert.equal(await page.getByText(/^Ver detalles ·/).count(),0); assert.equal(await page.getByRole('article').count(),0);
  await readOnly(page,raw);
});

const CONSTELLATION_KEY='fh:harmonic-constellations-v1';
async function openBuilder(page) {
  await page.getByText('Constructor de constelaciones · construir, validar y guardar',{exact:true}).click();
  await page.getByRole('spinbutton',{name:'Semilla del Builder (Hz)',exact:true}).waitFor();
}
const builderPreview=page=>page.getByRole('region',{name:'Vista previa de constelación',exact:true});
const builderSignature=page=>page.getByRole('textbox',{name:'Firma de la constelación del Builder',exact:true});
async function validBuilder(page) {
  await builderPreview(page).waitFor();
  await eventually(async()=>assert.match(await builderSignature(page).inputValue(),/^sha256:[a-f0-9]{64}$/));
}

test('builder: independent exact members, multiplicity, sequence reorder, name invariant and no side effects',async t=>{
  const page=await fixture(t),before=await controls(page);await openBuilder(page);
  await button(page,'Añadir raíz').click();await button(page,'Añadir raíz').click();
  await button(page,'Añadir ratio').click();await validBuilder(page);
  let rows=await page.getByRole('table',{name:'Miembros del borrador · sin reproducción'}).locator('tbody tr').allTextContents();assert.equal(rows.length,3);
  assert.match(rows[0],/432 Hz/);assert.match(rows[1],/432 Hz/);assert.match(rows[2],/648 Hz/);
  assert.match(await builderPreview(page).innerText(),/Compatible con estructura/);
  const signature=await builderSignature(page).inputValue();
  await page.getByRole('textbox',{name:'Nombre de constelación (opcional)',exact:true}).fill('Evening Focus');await validBuilder(page);assert.equal(await builderSignature(page).inputValue(),signature);
  await button(page,'Subir miembro 3').click();await validBuilder(page);assert.notEqual(await builderSignature(page).inputValue(),signature);
  await button(page,'Quitar miembro 2').click();await validBuilder(page);
  rows=await page.getByRole('table',{name:'Miembros del borrador · sin reproducción'}).locator('tbody tr').allTextContents();assert.equal(rows.length,2);
  await page.getByRole('combobox',{name:'Modo de la constelación',exact:true}).selectOption('simultaneous');await validBuilder(page);
  assert.equal(await button(page,'Subir miembro 2').count(),0);
  await page.getByText('Constructor de constelaciones · construir, validar y guardar',{exact:true}).click();await openBuilder(page);
  assert.equal(await page.getByRole('textbox',{name:'Nombre de constelación (opcional)',exact:true}).inputValue(),'Evening Focus');
  assert.deepEqual(await controls(page),before);await noPlayback(page);
});

test('builder: unsupported ratios and octave types remain available; invalid values never clamp or save',async t=>{
  const page=await fixture(t);await openBuilder(page);
  await page.getByRole('combobox',{name:'Ratio del miembro',exact:true}).selectOption('5:3');await button(page,'Añadir ratio').click();await validBuilder(page);
  assert.match(await builderPreview(page).innerText(),/720 Hz/);assert.match(await builderPreview(page).innerText(),/Solo Builder/);
  await page.getByRole('combobox',{name:'Ratio del miembro',exact:true}).selectOption('2:1');await button(page,'Añadir ratio').click();await validBuilder(page);assert.match(await builderPreview(page).innerText(),/864 Hz/);
  for(const offset of ['-1','0','1']){await page.getByRole('spinbutton',{name:'Desplazamiento del miembro de octava',exact:true}).fill(offset);await button(page,'Añadir octava').click();await validBuilder(page);}
  assert.match(await builderPreview(page).innerText(),/216 Hz/);
  await page.getByRole('spinbutton',{name:'Desplazamiento del miembro de octava',exact:true}).fill('3');await button(page,'Añadir octava').click();
  await page.getByRole('alert').filter({hasText:'No se corrigen los valores'}).waitFor();assert.equal(await button(page,'Guardar constelación').count(),0);
  assert.equal(await page.getByRole('spinbutton',{name:'Semilla del Builder (Hz)',exact:true}).inputValue(),'432');
  await button(page,'Quitar miembro 6').click();await validBuilder(page);
  await page.getByRole('spinbutton',{name:'Semilla del Builder (Hz)',exact:true}).fill('2001');
  await page.getByRole('alert').filter({hasText:'No se corrigen los valores'}).waitFor();assert.equal(await button(page,'Guardar constelación').count(),0);
  assert.equal(await page.getByRole('spinbutton',{name:'Semilla del Builder (Hz)',exact:true}).inputValue(),'2001');await noPlayback(page);
});

test('builder: explicit append, reload, read-only saved record, unchanged JSON export and separate namespace',async t=>{
  const {page,raw}=await historical(t,[readerRecord('cancelled')]);const before=await controls(page);await openBuilder(page);
  await button(page,'Añadir raíz').click();await button(page,'Añadir ratio').click();await validBuilder(page);
  await page.getByRole('textbox',{name:'Nombre de constelación (opcional)',exact:true}).fill('Saved Builder');await validBuilder(page);
  assert.deepEqual(await storage(page),{[KEY]:raw});assert.deepEqual((await probe(page)).writes,[]);
  await button(page,'Guardar constelación').click();await button(page,'Constelación guardada').waitFor();
  const savedStorage=await storage(page);assert.deepEqual(Object.keys(savedStorage).sort(),[KEY,CONSTELLATION_KEY].sort());assert.equal(savedStorage[KEY],raw);
  const [record]=JSON.parse(savedStorage[CONSTELLATION_KEY]);assert.equal(record.schemaVersion,1);assert.equal(record.generationVersion,'harmonic-constellation-v1');assert.equal(record.name,'Saved Builder');assert.equal(record.members.length,2);
  assert.equal((await probe(page)).writes.length,1);assert.equal((await probe(page)).contexts.length,0);
  assert.deepEqual(await controls(page),before);
  await page.reload();await openBuilder(page);await button(page,'Cargar constelación Saved Builder').click();await validBuilder(page);
  assert.ok(await page.getByRole('spinbutton',{name:'Semilla del Builder (Hz)',exact:true}).isDisabled());
  assert.ok(await button(page,'Constelación guardada').isDisabled());assert.equal(await builderSignature(page).inputValue(),record.signature);
  const pending=page.waitForEvent('download');await button(page,'Exportar constelación JSON').click();const download=await pending;
  const stream=await download.createReadStream();let text='';for await(const chunk of stream)text+=chunk;assert.deepEqual(JSON.parse(text),record);
  assert.deepEqual(await storage(page),savedStorage);assert.deepEqual((await probe(page)).writes,[]);assert.equal((await probe(page)).contexts.length,0);
  await button(page,'Nuevo borrador').click();await button(page,'Añadir raíz').click();await validBuilder(page);await button(page,'Guardar constelación').click();await button(page,'Constelación guardada').waitFor();
  const appended=JSON.parse((await storage(page))[CONSTELLATION_KEY]);assert.equal(appended.length,2);assert.deepEqual(appended[0],record);assert.notEqual(appended[1].id,record.id);assert.equal((await storage(page))[KEY],raw);
});

test('builder: corrupt constellation storage preserved; export original; no other keys or audio',async t=>{
  const page=await fixture(t);
  await page.evaluate(key=>localStorage.setItem(key,'{malformed'),CONSTELLATION_KEY);await page.reload();await openBuilder(page);
  await page.getByRole('alert').filter({hasText:'Almacenamiento de constelaciones inválido'}).waitFor();
  await button(page,'Añadir raíz').click();await validBuilder(page);assert.ok(await button(page,'Guardar constelación').isDisabled());
  const pending=page.waitForEvent('download');await button(page,'Exportar almacenamiento original de constelaciones').click();const download=await pending;
  const stream=await download.createReadStream();let text='';for await(const chunk of stream)text+=chunk;assert.equal(text,'{malformed');
  assert.deepEqual(await storage(page),{[CONSTELLATION_KEY]:'{malformed'});assert.deepEqual((await probe(page)).writes,[]);assert.equal((await probe(page)).contexts.length,0);
});

async function savedPlaybackFixture(t, playbackMode='sequence', unsupported) {
  const page=await fixture(t);await openBuilder(page);
  await page.getByRole('combobox',{name:'Modo de la constelación',exact:true}).selectOption(playbackMode);
  await button(page,'Añadir ratio').click();await button(page,'Añadir raíz').click();await button(page,'Añadir raíz').click();
  if(unsupported==='octave')await button(page,'Añadir octava').click();
  else if(unsupported){await page.getByRole('combobox',{name:'Ratio del miembro',exact:true}).selectOption(unsupported);await button(page,'Añadir ratio').click();}
  await page.getByRole('textbox',{name:'Nombre de constelación (opcional)',exact:true}).fill('Playback fixture');await validBuilder(page);
  await button(page,'Guardar constelación').click();await button(page,'Constelación guardada').waitFor();
  const raw=(await storage(page))[CONSTELLATION_KEY];await page.reload();await field(page,'Duración (minutos)').fill('1');await field(page,'Volumen (0–100)').fill('0');await openBuilder(page);
  return {page,raw};
}
async function previewConstellation(page){await button(page,'Preparar reproducción de Playback fixture').click();await page.getByRole('region',{name:'Confirmación de constelación guardada',exact:true}).waitFor();}
async function startConstellation(page){await button(page,'Confirmar y reproducir constelación').click();await page.getByRole('status').filter({hasText:/^Audio en curso$/}).waitFor();}
for(const playbackMode of ['sequence','simultaneous'])test(`saved constellation ${playbackMode}: load and preview silent, confirmation exact voices, stop and snapshot`,async t=>{
  const {page,raw}=await savedPlaybackFixture(t,playbackMode);const before=await controls(page);
  await button(page,'Cargar constelación Playback fixture').click();await validBuilder(page);
  assert.equal((await probe(page)).contexts.length,0);assert.deepEqual((await probe(page)).writes,[]);
  await previewConstellation(page);assert.equal((await probe(page)).contexts.length,0);assert.deepEqual(await controls(page),before);
  await page.getByRole('checkbox',{name:'Registrar la próxima sesión',exact:true}).check();
  await page.getByRole('combobox',{name:'Antes: Claridad',exact:true}).selectOption('0');
  await startConstellation(page);await graph(page,[648,432,432],playbackMode==='simultaneous');
  assert.ok(await button(page,'Confirmar e iniciar').isDisabled());assert.ok(await button(page,'Preparar reproducción de Playback fixture').isDisabled());
  await stop(page);await page.getByRole('status').filter({hasText:/Experimento: Cancelado por ti/}).waitFor();
  assert.deepEqual(await storage(page),{[CONSTELLATION_KEY]:raw});
  await button(page,'Guardar experimento').click();await button(page,'Experimento guardado').waitFor();
  const data=await storage(page);const [record]=JSON.parse(data[V2_KEY]);assert.equal(data[CONSTELLATION_KEY],raw);
  assert.deepEqual(record.configurationSnapshot,{baseHz:432,ratioId:'root',increments:1,direction:'ascending',mode:playbackMode,durationSeconds:60,uiVolume:0,waveform:'sine',progression:['fifth','root','root']});
  assert.equal(record.schemaVersion,2);assert.deepEqual(record.constellation.snapshot,JSON.parse(raw)[0]);assert.equal(record.constellation.signature,JSON.parse(raw)[0].signature);assert.equal(record.preState.clarity,0);assert.equal(record.status,'cancelled');assert.equal(record.completedAt,undefined);
  await page.reload();assert.deepEqual(await storage(page),data);assert.equal((await probe(page)).contexts.length,0);
});
for(const unsupported of ['5:3','2:1','octave'])test(`saved constellation rejects ${unsupported} without dropping members`,async t=>{
  const {page,raw}=await savedPlaybackFixture(t,'sequence',unsupported);await button(page,'Preparar reproducción de Playback fixture').click();
  await page.getByRole('alert').filter({hasText:'no representable exactamente'}).waitFor();assert.equal(await button(page,'Confirmar y reproducir constelación').count(),0);
  assert.equal((await probe(page)).contexts.length,0);assert.deepEqual((await probe(page)).writes,[]);assert.deepEqual(await storage(page),{[CONSTELLATION_KEY]:raw});
});
test('saved constellation: controls invalidate preview and changed saved record is rejected on confirmation',async t=>{
  const {page}=await savedPlaybackFixture(t);await previewConstellation(page);await field(page,'Volumen (0–100)').fill('1');assert.equal(await button(page,'Confirmar y reproducir constelación').count(),0);
  await field(page,'Volumen (0–100)').fill('0');await previewConstellation(page);
  await page.evaluate(key=>localStorage.setItem(key,'{corrupt'),CONSTELLATION_KEY);await button(page,'Confirmar y reproducir constelación').click();
  await page.getByRole('alert').filter({hasText:'Almacenamiento de constelaciones inválido'}).waitFor();assert.equal((await probe(page)).contexts.length,0);assert.equal((await storage(page))[CONSTELLATION_KEY],'{corrupt');assert.equal((await storage(page))[KEY],undefined);
});
test('saved constellation navigation: cleanup, no completed and no experiment autosave',async t=>{
  const {page,raw}=await savedPlaybackFixture(t);await previewConstellation(page);await page.getByRole('checkbox',{name:'Registrar la próxima sesión',exact:true}).check();await startConstellation(page);
  await page.getByRole('link',{name:'Inicio',exact:true}).click();await clean(page);
  assert.deepEqual(await storage(page),{[CONSTELLATION_KEY]:raw});assert.ok(!(await probe(page)).statuses.some(s=>s.includes('Completado')));
});
test('saved constellation natural end: completed only after native end, no autosave',async t=>{
  const {page,raw}=await savedPlaybackFixture(t,'simultaneous');await field(page,'Duración (minutos)').fill('0.02');await previewConstellation(page);
  await page.getByRole('checkbox',{name:'Registrar la próxima sesión',exact:true}).check();await startConstellation(page);
  await page.getByRole('status').filter({hasText:/Experimento: Completado/}).waitFor();
  await eventually(async()=>assert.ok((await probe(page)).contexts.every(c=>c.state==='closed'&&c.oscillators.every(o=>o.disconnected&&o.ended))));
  assert.deepEqual(await storage(page),{[CONSTELLATION_KEY]:raw});await button(page,'Guardar experimento').click();await button(page,'Experimento guardado').waitFor();
  const [record]=JSON.parse((await storage(page))[V2_KEY]);assert.equal(record.status,'completed');assert.ok(record.completedAt);assert.equal(record.configurationSnapshot.durationSeconds,1.2);
});

const guide=page=>page.getByRole('region',{name:'Guía por intención',exact:true});
async function interpretGuide(page,words){await page.getByRole('textbox',{name:'Tu intención de exploración',exact:true}).fill(words);await button(page,'Interpretar intención').click();await page.getByRole('combobox',{name:'Objetivo interpretado',exact:true}).waitFor();}
async function recommendGuide(page){await button(page,'Revisé mi intención · generar recomendación').click();await button(page,'Confirmar y escuchar propuesta').waitFor();}
for(const [words,goal] of [['Quiero calma','relaxation'],['Necesito concentrarme','focus'],['Quiero dormir mejor','sleep_preparation'],['Quiero recuperarme después de una reunión','relaxation'],['Quiero sentirme más centrado','relaxation'],['Quiero creatividad','creative_exploration'],['Quiero meditar','reflection'],['quiero evitar drenaje energético','relaxation']])test(`guided ${goal}: ${words}; interpretation, rule, provenance, no autoplay`,async t=>{
  const page=await fixture(t);await interpretGuide(page,words);assert.equal(await page.getByRole('combobox',{name:'Objetivo interpretado',exact:true}).inputValue(),goal);await noPlayback(page);
  await field(page,'Volumen de la guía (0–100)').fill('0');await recommendGuide(page);await noPlayback(page);await page.getByText('¿Por qué esta propuesta?',{exact:true}).click();assert.match(await guide(page).innerText(),new RegExp(`voice-${goal}-gentle`));
  assert.match(await guide(page).innerText(),/Sesiones comparables: 0/);await page.getByText('Detalles armónicos de la guía',{exact:true}).click();assert.match(await guide(page).innerText(),/256 Hz/);await noPlayback(page);
  await page.getByText('¿Por qué esta sesión?',{exact:true}).click();
  const rationale=page.getByRole('region',{name:'Explicación del protocolo',exact:true});
  assert.match(await rationale.innerText(),/Matemática/);assert.match(await rationale.innerText(),/Acústica/);assert.match(await rationale.innerText(),/Diseño de protocolo/);assert.match(await rationale.innerText(),/Exploratoria/);
  await noPlayback(page);const exported=await downloadGuide(page);assert.equal(exported.rule.id,exported.proposal.ruleId);
  if(goal==='creative_exploration'){assert.ok(await button(page,'Confirmar y escuchar propuesta').isDisabled());await page.getByRole('checkbox',{name:'Acepto la cascada experimental de la guía, sin promesas de resultados.',exact:true}).check();}
  await button(page,'Confirmar y escuchar propuesta').click();await page.getByRole('status').filter({hasText:/^Audio en curso$/}).waitFor();
  assert.deepEqual((await probe(page)).contexts.flatMap(c=>c.oscillators.map(o=>o.frequencies[0])),exported.proposal.schedule.steps.flatMap(step=>step.frequencies));
  await button(page,'Detener audio del laboratorio').click();await clean(page);assert.deepEqual(await storage(page),{});
});
test('guided correction and medical boundary: no hidden recommendation or audio',async t=>{
  const page=await fixture(t);await interpretGuide(page,'Quiero meditar');await recommendGuide(page);await button(page,'Corregir interpretación').click();
  await page.getByRole('combobox',{name:'Objetivo interpretado',exact:true}).selectOption('focus');await recommendGuide(page);await page.getByText('¿Por qué esta propuesta?',{exact:true}).click();assert.match(await guide(page).innerText(),/voice-focus-gentle/);await noPlayback(page);
  await button(page,'No era lo que quería decir · editar texto').click();assert.equal(await button(page,'Confirmar y escuchar propuesta').count(),0);
  await page.getByRole('textbox',{name:'Tu intención de exploración',exact:true}).fill('Quiero curar dolor de pecho');await button(page,'Interpretar intención').click();await page.getByRole('alert').filter({hasText:'no prescribe sesiones'}).waitFor();assert.equal(await button(page,'Confirmar y escuchar propuesta').count(),0);await noPlayback(page);
});
async function downloadGuide(page){const pending=page.waitForEvent('download');await button(page,'Exportar propuesta y explicación').click();const stream=await(await pending).createReadStream();let text='';for await(const chunk of stream)text+=chunk;return JSON.parse(text);}
for(const [n,label] of [[0,'Evidencia personal insuficiente'],[4,'Evidencia personal insuficiente'],[5,'Señal personal preliminar'],[9,'Señal personal preliminar'],[10,'Patrón personal descriptivo']])test(`guided evidence UI N=${n}: no ranking mutation, export, no storage write`,async t=>{
  const page=await fixture(t);await interpretGuide(page,'Quiero calma 5 minutos');await recommendGuide(page);const original=await downloadGuide(page);const proposal=original.proposal;
  const rows=Array.from({length:n},(_,i)=>({schemaVersion:1,id:`guided-evidence-${i}`,createdAt:'2026-09-01T12:00:00.000Z',completedAt:'2026-09-01T12:05:00.000Z',status:'completed',intent:proposal.intent,proposal,markers:[],before:{clarity:0,stress:4,focus:2},after:{clarity:1,stress:3,focus:3},technical:{actualDurationMs:300000,stopReason:'completed'}}));
  const raw=JSON.stringify(rows);await page.evaluate(raw=>localStorage.setItem('fh:voice-sessions-v1',raw),raw);await page.reload();await interpretGuide(page,'Quiero calma 5 minutos');await recommendGuide(page);
  assert.match(await guide(page).innerText(),new RegExp(`Sesiones comparables: ${n} · ${label}`));const exported=await downloadGuide(page);assert.deepEqual(exported.proposal.harmonicConfig,original.proposal.harmonicConfig);assert.equal(exported.proposal.seedSelection.selectedSeedHz,original.proposal.seedSelection.selectedSeedHz);assert.equal(exported.proposal.ruleId,original.proposal.ruleId);assert.equal(exported.personalEvidence.comparableSessions,n);assert.equal(exported.personalEvidence.metrics.length,n<5?0:3);
  assert.deepEqual(await storage(page),{'fh:voice-sessions-v1':raw});assert.deepEqual((await probe(page)).writes,[]);assert.equal((await probe(page)).contexts.length,0);
});
test('guided corrupt history: evidence unavailable, never N=0 or repair',async t=>{
  const page=await fixture(t);await page.evaluate(()=>localStorage.setItem('fh:voice-sessions-v1','{invalid'));await page.reload();await interpretGuide(page,'Quiero calma');await recommendGuide(page);
  assert.match(await guide(page).innerText(),/Evidencia no disponible/);assert.doesNotMatch(await guide(page).innerText(),/Sesiones comparables: 0/);assert.deepEqual(await storage(page),{'fh:voice-sessions-v1':'{invalid'});assert.deepEqual((await probe(page)).writes,[]);assert.equal((await probe(page)).contexts.length,0);
});
test('guided confirmation: exact existing rule, shared stop, explicit unchanged experiment snapshot',async t=>{
  const page=await fixture(t);await interpretGuide(page,'Quiero calma 5 minutos');await page.getByRole('spinbutton',{name:'Volumen de la guía (0–100)',exact:true}).fill('0');await recommendGuide(page);const rec=await downloadGuide(page);
  await page.getByRole('checkbox',{name:'Registrar la próxima sesión',exact:true}).check();await button(page,'Confirmar y escuchar propuesta').click();await page.getByRole('status').filter({hasText:/^Audio en curso$/}).waitFor();
  const audio=await probe(page);assert.deepEqual(audio.contexts.flatMap(c=>c.oscillators.map(o=>o.frequencies[0])),rec.proposal.schedule.steps.flatMap(s=>s.frequencies));assert.ok(await button(page,'Confirmar e iniciar').isDisabled());
  await button(page,'Detener audio del laboratorio').click();await clean(page);assert.deepEqual(await storage(page),{});await button(page,'Guardar experimento').click();await button(page,'Experimento guardado').waitFor();
  const data=await storage(page);assert.deepEqual(Object.keys(data),[KEY]);const [record]=JSON.parse(data[KEY]);assert.deepEqual(record.configurationSnapshot,rec.proposal.harmonicConfig);assert.equal(record.status,'cancelled');
});
test('guided creativity: extra consent, unchanged cascade and navigation cleanup',async t=>{
  const page=await fixture(t);await interpretGuide(page,'Quiero creatividad 5 minutos');await page.getByRole('spinbutton',{name:'Volumen de la guía (0–100)',exact:true}).fill('0');await recommendGuide(page);const rec=await downloadGuide(page);
  assert.ok(await button(page,'Confirmar y escuchar propuesta').isDisabled());await page.getByRole('checkbox',{name:'Acepto la cascada experimental de la guía, sin promesas de resultados.',exact:true}).check();await button(page,'Confirmar y escuchar propuesta').click();await page.getByRole('status').filter({hasText:/^Audio en curso$/}).waitFor();
  assert.deepEqual((await probe(page)).contexts.flatMap(c=>c.oscillators.map(o=>o.frequencies[0])),rec.proposal.schedule.steps.flatMap(s=>s.frequencies));
  await page.getByRole('link',{name:'Inicio',exact:true}).click();await clean(page);assert.deepEqual(await storage(page),{});assert.ok(!(await probe(page)).statuses.some(s=>s.includes('Completado')));
});

async function linkedExperimentFixture(t){
  const {page,raw}=await savedPlaybackFixture(t);await previewConstellation(page);await page.getByRole('checkbox',{name:'Registrar la próxima sesión',exact:true}).check();await page.getByRole('combobox',{name:'Antes: Claridad',exact:true}).selectOption('0');await startConstellation(page);await stop(page);await button(page,'Guardar experimento').click();await button(page,'Experimento guardado').waitFor();
  const experimentRaw=(await storage(page))[V2_KEY];return {page,raw,experimentRaw,record:JSON.parse(experimentRaw)[0]};
}
async function openLinkedReader(page,id){await page.getByText('Experimentos guardados (1)',{exact:true}).click();await page.getByText(/^Ver detalles ·/).click();await page.getByRole('article',{name:`Experimento guardado ${id}`,exact:true}).waitFor();return page.getByRole('region',{name:'Constelación vinculada',exact:true});}
test('V2 audit: exact identity/definition/config, source rename/delete independent and export unchanged',async t=>{
  const {page,raw,experimentRaw,record}=await linkedExperimentFixture(t);await page.reload();let linked=await openLinkedReader(page,record.id);
  assert.match(await linked.innerText(),/Playback fixture/);assert.match(await linked.innerText(),new RegExp(record.constellation.id));assert.match(await linked.innerText(),new RegExp(record.constellation.signature));await linked.getByRole('status').filter({hasText:'coincide con el snapshot'}).waitFor();assert.equal((await probe(page)).contexts.length,0);assert.deepEqual((await probe(page)).writes,[]);
  const renamed=JSON.parse(raw);renamed[0].name='Renamed source';await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key:CONSTELLATION_KEY,value:JSON.stringify(renamed)});await page.reload();linked=await openLinkedReader(page,record.id);await linked.getByRole('status').filter({hasText:'cambió desde la confirmación'}).waitFor();assert.match(await linked.innerText(),/Playback fixture/);assert.doesNotMatch(await linked.innerText(),/Renamed source/);
  await page.evaluate(key=>localStorage.removeItem(key),CONSTELLATION_KEY);await page.reload();linked=await openLinkedReader(page,record.id);await linked.getByRole('status').filter({hasText:'ya no está disponible'}).waitFor();
  const pending=page.waitForEvent('download');await button(page,'Exportar registro guardado').click();const stream=await(await pending).createReadStream();let exported='';for await(const chunk of stream)exported+=chunk;assert.deepEqual(JSON.parse(exported),record);assert.deepEqual(await storage(page),{[V2_KEY]:experimentRaw});assert.deepEqual((await probe(page)).writes,[]);assert.equal((await probe(page)).contexts.length,0);
});
test('V2 invalid signature is preserved, while legacy V1 still renders unchanged',async t=>{
  const {page,record}=await linkedExperimentFixture(t);record.constellation.signature='sha256:corrupt';const bad=JSON.stringify([record]);const legacy=readerRecord('cancelled');const rawLegacy=JSON.stringify([legacy]);
  await page.evaluate(({bad,rawLegacy,k1,k2})=>{localStorage.setItem(k1,rawLegacy);localStorage.setItem(k2,bad);},{bad,rawLegacy,k1:KEY,k2:V2_KEY});await page.reload();await page.getByText('Experimentos guardados (1)',{exact:true}).click();await page.getByRole('alert').filter({hasText:'Historial V2 inválido'}).waitFor();await page.getByText(/^Ver detalles ·/).click();await page.getByRole('article',{name:`Experimento guardado ${legacy.id}`,exact:true}).waitFor();assert.match(await page.getByRole('article').innerText(),/Registro legado V1/);assert.equal(await page.getByRole('region',{name:'Constelación vinculada',exact:true}).count(),0);
  assert.equal((await storage(page))[KEY],rawLegacy);assert.equal((await storage(page))[V2_KEY],bad);assert.deepEqual((await probe(page)).writes,[]);assert.equal((await probe(page)).contexts.length,0);
});
test('V2 confirmation race during Web Crypto: changed source rejects without audio/autosave/completed',async t=>{
  const {page}=await savedPlaybackFixture(t);await previewConstellation(page);await page.getByRole('checkbox',{name:'Registrar la próxima sesión',exact:true}).check();
  await page.evaluate(()=>{const original=crypto.subtle.digest.bind(crypto.subtle);let once=true;crypto.subtle.digest=async(...args)=>{if(once){once=false;window.__auditWaiting=true;await new Promise(resolve=>{window.__auditRelease=resolve;});}return original(...args);};});
  await button(page,'Confirmar y reproducir constelación').click();await eventually(async()=>assert.equal(await page.evaluate(()=>window.__auditWaiting),true));
  await page.evaluate(key=>{const rows=JSON.parse(localStorage.getItem(key));rows[0].name='Changed during confirmation';localStorage.setItem(key,JSON.stringify(rows));window.__auditRelease();},CONSTELLATION_KEY);
  await page.getByRole('alert').filter({hasText:'fuente cambió durante la confirmación'}).waitFor();assert.equal((await probe(page)).contexts.length,0);assert.equal((await storage(page))[V2_KEY],undefined);assert.equal((await storage(page))[KEY],undefined);assert.ok(!(await probe(page)).statuses.some(s=>s.includes('Completado')));
});


test('2B Voice Journey shares rationale and evidence without changing legacy proposal or starting early',async t=>{
  const page=await fixture(t);await page.goto(harness.origin+'/voz');await button(page,'Entendido, continuar').click();const consentStorage=await storage(page);
  await page.getByRole('textbox',{name:'¿Qué quieres explorar?',exact:true}).fill('Quiero enfoque profundo 5 minutos');await button(page,'Interpretar intención').click();
  await page.getByText('Cambiar interpretación',{exact:true}).click();await page.getByRole('combobox',{name:'Objetivo',exact:true}).waitFor();assert.equal((await probe(page)).contexts.length,0);
  await page.getByText('Ajustes armónicos avanzados',{exact:true}).click();await field(page,'Volumen inicial (0–100)').fill('0');
  await button(page,'Generar recomendación').click();await page.getByText('¿Por qué esta sesión?',{exact:true}).click();await page.getByText('Detalles de la recomendación',{exact:true}).click();
  assert.match(await page.getByRole('region',{name:'Explicación del protocolo'}).innerText(),/224 Hz/);
  await page.getByText('Evidencia personal',{exact:true}).click();assert.match(await page.getByRole('region',{name:'Evidencia personal de la sesión'}).innerText(),/Sesiones comparables: 0/);
  assert.equal((await probe(page)).contexts.length,0);assert.deepEqual(await storage(page),consentStorage);
  await button(page,'Continuar').click();await button(page,'Iniciar sesión').click();await button(page,'Detener sesión').waitFor();
  assert.deepEqual((await probe(page)).contexts.flatMap(c=>c.oscillators.map(o=>o.frequencies[0])),[224,336,224,336]);
  await button(page,'Detener sesión').click();await clean(page);assert.deepEqual(await storage(page),consentStorage);
});
test('2B unknown intention requires human review; Voice medical text creates no proposal',async t=>{
  const page=await fixture(t);await interpretGuide(page,'Una cosa desconocida');assert.equal(await page.getByRole('combobox',{name:'Objetivo interpretado'}).inputValue(),'custom');
  assert.equal(await button(page,'Confirmar y escuchar propuesta').count(),0);await noPlayback(page);
  await page.goto(harness.origin+'/voz');await button(page,'Entendido, continuar').click();const consentStorage=await storage(page);await page.getByRole('textbox',{name:'¿Qué quieres explorar?',exact:true}).fill('Quiero curar dolor de pecho');await button(page,'Interpretar intención').click();
  await page.getByRole('alert').filter({hasText:'no prescribe sesiones'}).waitFor();assert.equal(await button(page,'Generar recomendación').count(),0);assert.equal((await probe(page)).contexts.length,0);assert.deepEqual(await storage(page),consentStorage);
});

const DISCOVERY_KEY='fh:protocol-discovery-plans-v1';
async function openDiscovery(page){await page.getByText('Protocol Discovery · comparación personal',{exact:true}).click();}
async function draftDiscovery(page){
  await openDiscovery(page);await page.getByRole('textbox',{name:'Intención Discovery',exact:true}).fill('Quiero recuperarme 5 minutos');await button(page,'Interpretar intención Discovery').click();
  await page.getByRole('textbox',{name:'Semillas elegidas (2–3 Hz separados por coma)',exact:true}).fill('144,220');await field(page,'Volumen Discovery').fill('0');await field(page,'Asignaciones por candidato').fill('3');
}
async function activateDiscovery(page){await button(page,'Validar candidatos y crear borrador').click();await button(page,'Guardar plan Discovery').click();await button(page,'Activar plan Discovery').click();await button(page,'Preparar siguiente asignación').waitFor();}
async function prepareDiscovery(page){await button(page,'Preparar siguiente asignación').click();await page.getByRole('combobox',{name:'Expectativa Discovery (0–10, requerida)',exact:true}).selectOption('0');}
async function reloadDiscovery(page){await page.reload();await openDiscovery(page);const rows=JSON.parse((await storage(page))[DISCOVERY_KEY]);await page.getByRole('combobox',{name:'Plan guardado',exact:true}).selectOption(rows[0].id);return rows;}

test('Discovery UI create/review/activate/confirm/cancel/save/reload: assignment fixed, context and zero preserved',async t=>{
  const page=await fixture(t);await draftDiscovery(page);await activateDiscovery(page);assert.equal((await probe(page)).contexts.length,0);
  await prepareDiscovery(page);await page.getByRole('combobox',{name:'Antes Discovery Energía',exact:true}).selectOption('0');
  await page.getByRole('textbox',{name:'Contexto Discovery (etiquetas opcionales separadas por coma)',exact:true}).fill('after-work');await page.getByRole('textbox',{name:'Dispositivo / auriculares (opcional)',exact:true}).fill('headphones');
  assert.equal((await probe(page)).contexts.length,0);await button(page,'Confirmar y reproducir asignación').click();await page.getByRole('heading',{name:'Resultado: started · sin guardar',exact:true}).waitFor();
  const reserved=JSON.parse((await storage(page))[DISCOVERY_KEY])[0];assert.equal(reserved.assignments[0].status,'reserved');assert.equal(reserved.assignments[0].result,undefined);
  await button(page,'Detener asignación Discovery').click();await clean(page);await page.getByRole('combobox',{name:'Después Discovery Energía',exact:true}).selectOption('3');await button(page,'Guardar resultado Discovery').click();await button(page,'Preparar siguiente asignación').waitFor();
  const [p]=await reloadDiscovery(page);const r=p.assignments[0].result;assert.equal(r.experiment.status,'cancelled');assert.equal(r.experiment.expectationScore,0);assert.equal(r.experiment.preState.energy,0);assert.equal(r.experiment.postState.energy,3);assert.equal(r.experiment.preState.focus,undefined);assert.deepEqual(r.context,{tags:['after-work'],device:'headphones'});assert.deepEqual(r.experiment.configurationSnapshot,p.candidates[0].config);
  assert.match(await page.getByRole('region',{name:'Protocol Discovery',exact:true}).innerText(),/N completadas: 0/);
  await button(page,'Omitir asignación (registrar omisión)').click();await eventually(async()=>assert.equal(JSON.parse((await storage(page))[DISCOVERY_KEY])[0].assignments[1].status,'skipped'));assert.deepEqual(Object.keys(await storage(page)),[DISCOVERY_KEY]);
});
test('Discovery saved constellation: UI plan creation, source deletion independent, natural completion/save and next assignment',async t=>{
  const page=await fixture(t);await openBuilder(page);
  for(const [i,seed] of [144,220].entries()){
    if(i)await button(page,'Nuevo borrador').click();await field(page,'Semilla del Builder (Hz)').fill(String(seed));await button(page,'Añadir raíz').click();await page.getByRole('combobox',{name:'Ratio del miembro',exact:true}).selectOption('3:2');await button(page,'Añadir ratio').click();await page.getByRole('textbox',{name:'Nombre de constelación (opcional)',exact:true}).fill(`Discovery source ${i}`);await validBuilder(page);await button(page,'Guardar constelación').click();await button(page,'Constelación guardada').waitFor();
  }
  const sources=JSON.parse((await storage(page))[CONSTELLATION_KEY]);await page.getByText('Constructor de constelaciones · construir, validar y guardar',{exact:true}).click();
  await draftDiscovery(page);await page.getByRole('combobox',{name:'Origen de candidatos',exact:true}).selectOption('saved');await button(page,'Cargar constelaciones para comparar').click();
  for(let i=0;i<2;i++)await page.getByRole('checkbox',{name:new RegExp(`Discovery source ${i}`)}).check();await field(page,'Duración Discovery (segundos)').fill('1.2');await activateDiscovery(page);
  const original=JSON.parse((await storage(page))[DISCOVERY_KEY])[0];await page.evaluate(rows=>localStorage.setItem('fh:harmonic-constellations-v1',JSON.stringify(rows.map(c=>({...c,name:'Renamed source'})))),sources);const [unchanged]=await reloadDiscovery(page);assert.deepEqual(unchanged.candidates,original.candidates);await page.evaluate(()=>localStorage.removeItem('fh:harmonic-constellations-v1'));
  await prepareDiscovery(page);await page.getByRole('combobox',{name:'Antes Discovery Energía',exact:true}).selectOption('1');await button(page,'Confirmar y reproducir asignación').click();await page.getByRole('heading',{name:'Resultado: completed · sin guardar',exact:true}).waitFor();
  await eventually(async()=>assert.ok((await probe(page)).contexts.every(c=>c.state==='closed'&&c.oscillators.every(o=>o.ended&&o.disconnected))));
  assert.deepEqual((await probe(page)).contexts.flatMap(c=>c.oscillators.map(o=>o.frequencies[0])),[144,216]);
  assert.equal(JSON.parse((await storage(page))[DISCOVERY_KEY])[0].assignments[0].result,undefined);
  await page.getByRole('combobox',{name:'Después Discovery Energía',exact:true}).selectOption('2');await button(page,'Guardar resultado Discovery').click();await button(page,'Preparar siguiente asignación').waitFor();
  const [saved]=await reloadDiscovery(page);assert.equal(saved.assignments[0].status,'completed');assert.deepEqual(saved.assignments[0].result.experiment.constellation.snapshot,original.candidates[0].constellation);assert.match(await page.getByRole('region',{name:'Protocol Discovery',exact:true}).innerText(),/Siguiente asignación: 2/);
});
test('Discovery navigation interruption keeps unresolved reservation, no false completed result, explicit recovery',async t=>{
  const page=await fixture(t);await draftDiscovery(page);await activateDiscovery(page);await prepareDiscovery(page);await button(page,'Confirmar y reproducir asignación').click();await page.getByRole('heading',{name:'Resultado: started · sin guardar',exact:true}).waitFor();
  await page.getByRole('link',{name:'Inicio',exact:true}).click();await clean(page);let p=JSON.parse((await storage(page))[DISCOVERY_KEY])[0];assert.equal(p.assignments[0].status,'reserved');assert.equal(p.assignments[0].result,undefined);
  await page.goto(harness.origin+'/laboratorio-armonico');await openDiscovery(page);await page.getByRole('combobox',{name:'Plan guardado',exact:true}).selectOption(p.id);await button(page,'Confirmar cierre como interrumpida').click();await button(page,'Preparar siguiente asignación').waitFor();p=JSON.parse((await storage(page))[DISCOVERY_KEY])[0];assert.equal(p.assignments[0].status,'interrupted');assert.equal(p.assignments[0].result,undefined);
});
test('Discovery corruption is preserved and exportable; no silent repair or playback',async t=>{
  const page=await fixture(t);await page.evaluate(()=>localStorage.setItem('fh:protocol-discovery-plans-v1','{bad'));await page.reload();await openDiscovery(page);
  await page.getByRole('alert').filter({hasText:'Almacenamiento Discovery inválido'}).waitFor();assert.equal((await storage(page))[DISCOVERY_KEY],'{bad');assert.deepEqual((await probe(page)).writes,[]);assert.equal((await probe(page)).contexts.length,0);
});

const PERSONAL_KEY='fh:personalized-experiments-v1';
// Synthetic completed records produced by tests/personalization-fixtures.ts using the real validators/compiler.
async function personalFixtureUI(t,adjust){
  const {readFile}=await import('node:fs/promises');
  const rows=JSON.parse(await readFile(new URL('./fixtures/personalization-discovery-v1.json',import.meta.url),'utf8'));
  if(adjust)adjust(rows[0]);const raw=JSON.stringify(rows),page=await fixture(t);
  await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:DISCOVERY_KEY,raw});await page.reload();
  await page.getByText('Personalización · evidencia personal',{exact:true}).click();await button(page,'Cargar evidencia personal').click();
  await page.getByRole('combobox',{name:'Intención registrada',exact:true}).selectOption(rows[0].id);
  await button(page,'Generar recomendaciones personales').click();await page.getByRole('region',{name:'Ranking personal',exact:true}).waitFor();
  return {page,rows,raw};
}
async function choosePersonal(page,label){
  await button(page,`Elegir Protocolo ${label} · vista previa`).click();
  await page.getByRole('combobox',{name:'Expectativa personal (0–10, requerida)',exact:true}).selectOption('0');
  await page.getByRole('combobox',{name:'Antes personal Energía',exact:true}).selectOption('0');
}
for(const [label,id] of [['B','candidate-1'],['A','candidate-0']])test(`Personalization ${label}: ranked top/alternative, rationale, native audio, explicit exact experiment and export`,async t=>{
  const {page,rows,raw}=await personalFixtureUI(t);const ranking=page.getByRole('region',{name:'Ranking personal',exact:true});
  assert.match(await ranking.innerText(),/DESCRIPTIVE/);assert.match(await ranking.innerText(),/N = 10/);
  assert.deepEqual(await ranking.getByRole('article').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label'))),['Candidato personal candidate-1','Candidato personal candidate-0']);
  const card=page.getByRole('article',{name:`Candidato personal ${id}`,exact:true});await card.getByText('¿Por qué esta sesión?',{exact:true}).click();
  const why=page.getByRole('region',{name:`Por qué se priorizó ${id}`,exact:true});assert.match(await why.innerText(),/personalization-v1/);assert.match(await why.innerText(),/Expectativa media: 5/);assert.match(await why.innerText(),/Consistencia: 10\/10/);
  await choosePersonal(page,label);assert.equal((await probe(page)).contexts.length,0);assert.deepEqual(await storage(page),{[DISCOVERY_KEY]:raw});
  const selected=rows[0].candidates.find(c=>c.id===id);
  await button(page,'Confirmar y escuchar opción personal').click();
  if(label==='B'){
    await page.getByRole('heading',{name:'Sesión personal: completed · sin guardar',exact:true}).waitFor();
    await eventually(async()=>assert.ok((await probe(page)).contexts.every(c=>c.state==='closed'&&c.oscillators.every(o=>o.ended&&o.disconnected))));
  }else{
    await page.getByRole('heading',{name:'Sesión personal: started · sin guardar',exact:true}).waitFor();await button(page,'Detener sesión personal').click();await clean(page);
  }
  assert.deepEqual((await probe(page)).contexts.flatMap(c=>c.oscillators.map(o=>o.frequencies[0])),[selected.config.baseHz,selected.config.baseHz*1.5]);
  assert.deepEqual(await storage(page),{[DISCOVERY_KEY]:raw});await page.getByRole('combobox',{name:'Después personal Energía',exact:true}).selectOption('1');
  await button(page,'Guardar experimento personal').click();await page.getByText('Experimentos personales guardados (1)',{exact:true}).waitFor();
  const data=await storage(page),[saved]=JSON.parse(data[PERSONAL_KEY]);assert.equal(data[DISCOVERY_KEY],raw);assert.deepEqual(Object.keys(data).sort(),[DISCOVERY_KEY,PERSONAL_KEY].sort());
  assert.equal(saved.selectedCandidateId,id);assert.deepEqual(saved.experiment.configurationSnapshot,selected.config);assert.deepEqual(saved.experiment.constellation.snapshot,selected.constellation);
  assert.equal(saved.experiment.expectationScore,0);assert.equal(saved.experiment.preState.energy,0);assert.equal(saved.experiment.preState.focus,undefined);assert.equal(saved.experiment.status,label==='B'?'completed':'cancelled');
  assert.deepEqual(saved.recommendation.sourcePlans,rows);assert.equal(saved.recommendation.recommendations[0].provenance.length,10);
  await page.reload();await page.getByText('Personalización · evidencia personal',{exact:true}).click();await button(page,'Cargar evidencia personal').click();await page.getByText('Experimentos personales guardados (1)',{exact:true}).click();
  const pending=page.waitForEvent('download');await button(page,`Exportar experimento personal ${saved.experiment.id}`).click();const stream=await(await pending).createReadStream();let text='';for await(const chunk of stream)text+=chunk;assert.deepEqual(JSON.parse(text),saved);
  assert.deepEqual((await probe(page)).writes,[]);assert.equal((await probe(page)).contexts.length,0);
});
test('Personalization expectation confound and preliminary evidence retain alternatives and original order',async t=>{
  const {page}=await personalFixtureUI(t,p=>{p.assignments.forEach(a=>{a.result.experiment.expectationScore=a.candidateId==='candidate-0'?0:10;});});
  const ranking=page.getByRole('region',{name:'Ranking personal',exact:true});assert.match(await ranking.innerText(),/expectativas medias difieren/);
  assert.deepEqual(await ranking.getByRole('article').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label'))),['Candidato personal candidate-0','Candidato personal candidate-1']);
  await page.evaluate(key=>{const rows=JSON.parse(localStorage.getItem(key));rows[0].assignments=rows[0].assignments.map(a=>a.index<10?a:{index:a.index,candidateId:a.candidateId,status:'skipped',resolvedAt:a.resolvedAt});localStorage.setItem(key,JSON.stringify(rows));},DISCOVERY_KEY);
  await button(page,'Cargar evidencia personal').click();await page.getByRole('combobox',{name:'Intención registrada',exact:true}).selectOption('personal-plan');await button(page,'Generar recomendaciones personales').click();
  await eventually(async()=>assert.match(await ranking.innerText(),/PRELIMINARY/));assert.match(await ranking.innerText(),/N = 5/);assert.match(await ranking.innerText(),/se conserva el orden original/);assert.equal((await probe(page)).contexts.length,0);
});
test('Personalization changed evidence rejects confirmation without audio or implicit save',async t=>{
  const {page}=await personalFixtureUI(t);await choosePersonal(page,'B');
  await page.evaluate(key=>{const rows=JSON.parse(localStorage.getItem(key));rows[0].assignments[0].result.experiment.postState.energy=3;localStorage.setItem(key,JSON.stringify(rows));},DISCOVERY_KEY);
  await button(page,'Confirmar y escuchar opción personal').click();await page.getByRole('alert').filter({hasText:'La evidencia cambió.'}).waitFor();assert.equal((await probe(page)).contexts.length,0);assert.equal((await storage(page))[PERSONAL_KEY],undefined);
});
test('Personalization navigation interrupts native audio without completed state, save or plan mutation',async t=>{
  const {page,raw}=await personalFixtureUI(t);await choosePersonal(page,'A');await button(page,'Confirmar y escuchar opción personal').click();await page.getByRole('heading',{name:'Sesión personal: started · sin guardar',exact:true}).waitFor();
  await page.getByRole('link',{name:'Inicio',exact:true}).click();await clean(page);assert.deepEqual(await storage(page),{[DISCOVERY_KEY]:raw});assert.deepEqual((await probe(page)).writes,[]);
});
test('Personalization corrupt source cannot become no-evidence fallback or overwrite',async t=>{
  const page=await fixture(t);await page.evaluate(key=>localStorage.setItem(key,'{bad'),DISCOVERY_KEY);await page.getByText('Personalización · evidencia personal',{exact:true}).click();await button(page,'Cargar evidencia personal').click();
  const region=page.getByRole('region',{name:'Asesor personalizado',exact:true});await region.getByRole('alert').waitFor();assert.equal(await button(page,'Generar recomendaciones personales').count(),0);assert.equal((await storage(page))[DISCOVERY_KEY],'{bad');assert.equal((await probe(page)).contexts.length,0);
});
test('Personalization Web Crypto race rejects newly changed evidence before engine access',async t=>{
  const {page}=await personalFixtureUI(t);await choosePersonal(page,'B');
  await page.evaluate(()=>{const original=crypto.subtle.digest.bind(crypto.subtle);let once=true;crypto.subtle.digest=async(...args)=>{if(once){once=false;window.__personalWaiting=true;await new Promise(resolve=>{window.__personalRelease=resolve;});}return original(...args);};});
  await button(page,'Confirmar y escuchar opción personal').click();await eventually(async()=>assert.equal(await page.evaluate(()=>window.__personalWaiting),true));
  await page.evaluate(key=>{const rows=JSON.parse(localStorage.getItem(key));rows[0].assignments[0].result.experiment.postState.energy=3;localStorage.setItem(key,JSON.stringify(rows));window.__personalRelease();},DISCOVERY_KEY);
  await page.getByRole('alert').filter({hasText:'La evidencia cambió durante la confirmación'}).waitFor();assert.equal((await probe(page)).contexts.length,0);assert.equal((await storage(page))[PERSONAL_KEY],undefined);
});

async function openStructure(scope){
  await scope.getByText('Perfil estructural',{exact:true}).click();
  const profile=scope.getByRole('region',{name:'Perfil estructural',exact:true});
  await eventually(async()=>assert.match(await profile.innerText(),/HCI: [0-9]/));return profile;
}
async function exportStructure(page){const pending=page.waitForEvent('download');await button(page,'Exportar análisis estructural').click();const stream=await(await pending).createReadStream();let text='';for await(const chunk of stream)text+=chunk;return JSON.parse(text);}
test('HIP guided explanation displays exact versioned HCI without changing proposal, storage or playback',async t=>{
  const page=await fixture(t);await interpretGuide(page,'Quiero calma 5 minutos');await field(page,'Volumen de la guía (0–100)').fill('0');await recommendGuide(page);const original=await downloadGuide(page);
  await guide(page).getByText('¿Por qué esta sesión?',{exact:true}).click();const profile=await openStructure(guide(page));
  assert.match(await profile.innerText(),/harmonic-complexity-v1/);assert.match(await profile.innerText(),/no mide efectividad terapéutica/);assert.match(await profile.innerText(),/Miembros: 3/);
  assert.deepEqual(await downloadGuide(page),original);await noPlayback(page);
  await button(page,'Confirmar y escuchar propuesta').click();await page.getByRole('status').filter({hasText:/^Audio en curso$/}).waitFor();assert.deepEqual((await probe(page)).contexts.flatMap(c=>c.oscillators.map(o=>o.frequencies[0])),original.proposal.schedule.steps.flatMap(s=>s.frequencies));
  await button(page,'Detener audio del laboratorio').click();await clean(page);assert.deepEqual(await storage(page),{});
});
test('HIP Lab advanced sequence/simultaneous view updates descriptors only and retains exact audio',async t=>{
  const page=await fixture(t);const initial=await controls(page);await page.getByText('Complejidad estructural · avanzado',{exact:true}).click();
  const profile=page.getByRole('region',{name:'Complejidad estructural · avanzado',exact:true});await eventually(async()=>assert.match(await profile.innerText(),/HCI: [0-9]/));
  assert.match(await profile.innerText(),/Miembros: 2/);assert.match(await profile.innerText(),/Amplitud espectral: 216 Hz/);assert.deepEqual(await controls(page),initial);await noPlayback(page);
  await mode(page).selectOption('simultaneous');await eventually(async()=>assert.match(await profile.innerText(),/Orden significativo: no/));assert.match(await profile.innerText(),/orden 0/);await noPlayback(page);
  await start(page);await graph(page,[432,648],true);await stop(page);assert.deepEqual(await storage(page),{});
});
test('HIP personal profiles and structural groups preserve ranking, seed strata, evidence bytes and export versions',async t=>{
  const {page,raw,rows}=await personalFixtureUI(t);const ranking=page.getByRole('region',{name:'Ranking personal',exact:true});
  const before=await ranking.getByRole('article').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')));
  const card=page.getByRole('article',{name:'Candidato personal candidate-1',exact:true});await card.getByText('¿Por qué esta sesión?',{exact:true}).click();const profile=await openStructure(card);assert.match(await profile.innerText(),/harmonic-constellation-v1/);
  await page.getByText('Análisis estructural N=1 · avanzado',{exact:true}).click();const analysis=page.getByRole('region',{name:'Análisis estructural N=1',exact:true});
  await eventually(async()=>assert.equal(await analysis.getByRole('article').count(),2));assert.match(await analysis.innerText(),/Semilla 144 Hz/);assert.match(await analysis.innerText(),/Semilla 220 Hz/);assert.match(await analysis.innerText(),/asociación descriptiva del grupo completo/);
  for(const group of ['memberCount','ratioDiversity','octaveSpan','playbackMode']){await page.getByRole('combobox',{name:'Agrupar estructura por',exact:true}).selectOption(group);await eventually(async()=>assert.equal(await analysis.getByRole('article').count(),2));}
  const report=await exportStructure(page);assert.equal(report.profileVersion,'harmonic-information-v1');assert.equal(report.algorithmVersion,'harmonic-complexity-v1');assert.deepEqual(report.evidence.sourcePlans,rows);
  assert.deepEqual(report.evidence.orderedCandidateIds,['candidate-1','candidate-0']);assert.equal(report.groups.reduce((n,g)=>n+g.comparableN,0),20);assert.equal(report.groups.length,2);
  assert.deepEqual(await ranking.getByRole('article').filter({hasText:'Matemática validada'}).evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label'))),before);
  assert.deepEqual(await storage(page),{[DISCOVERY_KEY]:raw});assert.deepEqual((await probe(page)).writes,[]);assert.equal((await probe(page)).contexts.length,0);
});
test('HIP sparse structural evidence shows insufficient sessions, never pattern claims or missing-to-zero',async t=>{
  const {page,raw}=await personalFixtureUI(t,p=>{p.assignments=p.assignments.map(a=>a.index<10?a:{index:a.index,candidateId:a.candidateId,status:'skipped',resolvedAt:a.resolvedAt});p.assignments[0].result.experiment.preState={};});
  await page.getByText('Análisis estructural N=1 · avanzado',{exact:true}).click();const analysis=page.getByRole('region',{name:'Análisis estructural N=1',exact:true});
  await eventually(async()=>assert.equal(await analysis.getByRole('article').count(),2));assert.match(await analysis.innerText(),/N = 4/);assert.match(await analysis.innerText(),/N = 5/);assert.match(await analysis.innerText(),/Insufficient comparable sessions/);assert.doesNotMatch(await analysis.innerText(),/el cambio registrado/);
  assert.deepEqual(await storage(page),{[DISCOVERY_KEY]:raw});assert.equal((await probe(page)).contexts.length,0);
});
test('HIP Voice Journey explanation is optional, shows disclaimer and keeps existing confirmed playback',async t=>{
  const page=await fixture(t);await page.goto(harness.origin+'/voz');await button(page,'Entendido, continuar').click();const before=await storage(page);
  await page.getByRole('textbox',{name:'¿Qué quieres explorar?',exact:true}).fill('Quiero enfoque profundo 5 minutos');await button(page,'Interpretar intención').click();await page.getByText('Ajustes armónicos avanzados',{exact:true}).click();await field(page,'Volumen inicial (0–100)').fill('0');await button(page,'Generar recomendación').click();
  await page.getByText('¿Por qué esta sesión?',{exact:true}).click();await page.getByText('Detalles de la recomendación',{exact:true}).click();const profile=await openStructure(page);assert.match(await profile.innerText(),/Miembros: 4/);assert.match(await profile.innerText(),/no mide efectividad terapéutica/);assert.equal((await probe(page)).contexts.length,0);
  await button(page,'Continuar').click();await button(page,'Iniciar sesión').click();await button(page,'Detener sesión').waitFor();assert.deepEqual((await probe(page)).contexts.flatMap(c=>c.oscillators.map(o=>o.frequencies[0])),[224,336,224,336]);await button(page,'Detener sesión').click();await clean(page);assert.deepEqual(await storage(page),before);
});
test('HIP saved constellation preview retains exact multiplicity, immutable source and explicit playback',async t=>{
  const {page,raw}=await savedPlaybackFixture(t,'simultaneous');await previewConstellation(page);const scope=page.getByRole('region',{name:'Confirmación de constelación guardada',exact:true});const profile=await openStructure(scope);
  assert.match(await profile.innerText(),/Orden significativo: no/);assert.match(await profile.innerText(),/Repeticiones de frecuencia: 1/);assert.deepEqual(await storage(page),{[CONSTELLATION_KEY]:raw});assert.equal((await probe(page)).contexts.length,0);
  await startConstellation(page);await stop(page);assert.deepEqual(await storage(page),{[CONSTELLATION_KEY]:raw});
});
test('HIP invalid manual input hides the old profile, never corrects values or starts audio',async t=>{
  const page=await fixture(t);await page.getByText('Complejidad estructural · avanzado',{exact:true}).click();const profile=page.getByRole('region',{name:'Complejidad estructural · avanzado',exact:true});await eventually(async()=>assert.match(await profile.innerText(),/HCI: [0-9]/));
  await field(page,'Base (Hz)').fill('0');await eventually(async()=>assert.match(await profile.innerText(),/Perfil no disponible/));assert.doesNotMatch(await profile.innerText(),/HCI: [0-9]/);assert.equal(await field(page,'Base (Hz)').inputValue(),'0');assert.equal((await probe(page)).contexts.length,0);assert.deepEqual(await storage(page),{});
});

const ADAPTIVE_KEY='fh:adaptive-experiments-v1';
async function adaptiveFixtureUI(t,adjust){
  const {readFile}=await import('node:fs/promises');const rows=JSON.parse(await readFile(new URL('./fixtures/adaptive-discovery-v1.json',import.meta.url),'utf8'));if(adjust)adjust(rows);
  const page=await fixture(t),raw=JSON.stringify(rows);await page.evaluate(({raw,key})=>localStorage.setItem(key,raw),{raw,key:DISCOVERY_KEY});await page.reload();
  await page.getByText('Personalización · evidencia personal',{exact:true}).click();await button(page,'Cargar evidencia personal').click();await page.getByRole('combobox',{name:'Intención registrada',exact:true}).selectOption(rows[0].id);await button(page,'Generar recomendaciones personales').click();
  await page.getByText('Próxima sesión informativa · exploración opcional',{exact:true}).click();await button(page,'Generar próxima sugerencia').click();await page.getByRole('region',{name:'Por qué esta próxima sesión',exact:true}).waitFor();return {page,rows,raw};
}
async function chooseAdaptive(page,override=false){
  if(override){await button(page,'Elegir otra opción válida').click();await button(page,'Explorar Protocolo A · vista previa').click();}else await button(page,'Usar esta sesión · vista previa').click();
  await page.getByRole('combobox',{name:'Expectativa exploratoria (0–10, requerida)',exact:true}).selectOption('0');await page.getByRole('combobox',{name:'Antes exploración Energía',exact:true}).selectOption('0');
}
for(const override of [false,true])test(`Adaptive ${override?'override':'accept'}: best differs from next, explicit audio/save, exact audit and equal follow-up eligibility`,async t=>{
  const {page,rows,raw}=await adaptiveFixtureUI(t);const region=page.getByRole('region',{name:'Exploración adaptativa',exact:true});
  assert.match(await region.innerText(),/Protocolo A · N=10 · Phase 2D/);assert.match(await region.innerText(),/Protocolo B · N = 10/);assert.match(await region.innerText(),/uncertainty-reduction/);assert.match(await region.innerText(),/adaptive-exploration-v1/);
  await chooseAdaptive(page,override);assert.equal((await probe(page)).contexts.length,0);assert.deepEqual(await storage(page),{[DISCOVERY_KEY]:raw});
  await button(page,'Confirmar y reproducir exploración').click();await page.getByRole('heading',{name:'Exploración: completed · sin guardar',exact:true}).waitFor();
  await eventually(async()=>assert.ok((await probe(page)).contexts.every(c=>c.state==='closed'&&c.oscillators.every(o=>o.ended&&o.disconnected))));
  const candidate=rows[0].candidates[override?0:1];assert.deepEqual((await probe(page)).contexts.flatMap(c=>c.oscillators.map(o=>o.frequencies[0])),[candidate.config.baseHz,candidate.config.baseHz*1.5]);assert.deepEqual(await storage(page),{[DISCOVERY_KEY]:raw});
  await page.getByRole('combobox',{name:'Después exploración Energía',exact:true}).selectOption('1');await button(page,'Guardar resultado exploratorio').click();await page.getByText('Resultados exploratorios guardados (1)',{exact:true}).waitFor();
  const data=await storage(page),[saved]=JSON.parse(data[ADAPTIVE_KEY]);assert.deepEqual(Object.keys(data).sort(),[DISCOVERY_KEY,ADAPTIVE_KEY].sort());assert.equal(data[DISCOVERY_KEY],raw);assert.equal(saved.suggestionFollowed,!override);assert.equal(saved.chosenCandidateId,candidate.id);assert.equal(saved.suggestion.suggestedNextCandidateId,'candidate-1');assert.deepEqual(saved.experiment.configurationSnapshot,candidate.config);assert.deepEqual(saved.experiment.constellation.snapshot,candidate.constellation);assert.equal(saved.experiment.expectationScore,0);assert.equal(saved.experiment.preState.energy,0);assert.equal(saved.experiment.preState.focus,undefined);
  await button(page,'Generar próxima sugerencia').click();await page.getByRole('region',{name:'Por qué esta próxima sesión',exact:true}).waitFor();await page.getByText('¿Qué hemos explorado?',{exact:true}).click();assert.match(await page.getByRole('region',{name:`Cobertura ${candidate.id}`,exact:true}).innerText(),/N=11: Discovery 10 \+ exploración 1/);assert.match(await region.innerText(),/Protocolo A · N=10 · Phase 2D/);
  await page.getByText('Resultados exploratorios guardados (1)',{exact:true}).click();const pending=page.waitForEvent('download');await button(page,`Exportar resultado exploratorio ${saved.experiment.id}`).click();const stream=await(await pending).createReadStream();let text='';for await(const chunk of stream)text+=chunk;assert.deepEqual(JSON.parse(text),saved);
});
test('Adaptive active fixed plan requires outside-plan choice and never mutates assignments',async t=>{
  const {page,raw}=await adaptiveFixtureUI(t,rows=>{const active=structuredClone(rows[0]);active.id='active-fixed';active.status='active';active.assignments=active.assignments.map(a=>({index:a.index,candidateId:a.candidateId,status:'pending'}));rows.push(active);});
  await page.getByRole('region',{name:'Planes fijos activos',exact:true}).waitFor();assert.equal(await button(page,'Usar esta sesión · vista previa').isDisabled(),true);await page.getByRole('checkbox',{name:'Quiero una exploración fuera de estos planes fijos',exact:true}).check();await chooseAdaptive(page);await button(page,'Confirmar y reproducir exploración').click();await page.getByRole('heading',{name:'Exploración: started · sin guardar',exact:true}).waitFor();await button(page,'Detener exploración').click();await clean(page);await page.getByRole('heading',{name:'Exploración: cancelled · sin guardar',exact:true}).waitFor();assert.deepEqual(await storage(page),{[DISCOVERY_KEY]:raw});await button(page,'Guardar resultado exploratorio').click();await page.getByText('Resultados exploratorios guardados (1)',{exact:true}).waitFor();assert.equal((await storage(page))[DISCOVERY_KEY],raw);assert.equal(JSON.parse((await storage(page))[ADAPTIVE_KEY])[0].experiment.status,'cancelled');
});
test('Adaptive navigation interrupts without saving or false completion',async t=>{
  const {page,raw}=await adaptiveFixtureUI(t);await chooseAdaptive(page);await button(page,'Confirmar y reproducir exploración').click();await page.getByRole('heading',{name:'Exploración: started · sin guardar',exact:true}).waitFor();await page.getByRole('link',{name:'Inicio',exact:true}).click();await clean(page);assert.deepEqual(await storage(page),{[DISCOVERY_KEY]:raw});assert.deepEqual((await probe(page)).writes,[]);
});
test('Adaptive changed evidence rejects preview confirmation without audio',async t=>{
  const {page}=await adaptiveFixtureUI(t);await chooseAdaptive(page);await page.evaluate(key=>localStorage.setItem(key,'[]'),ADAPTIVE_KEY);await button(page,'Confirmar y reproducir exploración').click();await page.getByRole('alert').filter({hasText:'La evidencia o los planes cambiaron'}).waitFor();assert.equal((await probe(page)).contexts.length,0);assert.equal((await storage(page))[ADAPTIVE_KEY],'[]');
});
test('Adaptive corrupt history is preserved and cannot become an empty evidence fallback',async t=>{
  const {page}=await adaptiveFixtureUI(t);await page.evaluate(key=>localStorage.setItem(key,'{bad'),ADAPTIVE_KEY);await button(page,'Generar próxima sugerencia').click();await page.getByRole('region',{name:'Exploración adaptativa',exact:true}).getByRole('alert').waitFor();assert.equal(await button(page,'Usar esta sesión · vista previa').count(),0);assert.equal((await storage(page))[ADAPTIVE_KEY],'{bad');assert.equal((await probe(page)).contexts.length,0);
});
test('Adaptive asynchronous signature race rejects evidence changes before audio',async t=>{
  const {page}=await adaptiveFixtureUI(t);await chooseAdaptive(page);
  await page.evaluate(()=>{const original=crypto.subtle.digest.bind(crypto.subtle);let once=true;crypto.subtle.digest=async(...args)=>{if(once){once=false;window.__adaptiveWaiting=true;await new Promise(resolve=>{window.__adaptiveRelease=resolve;});}return original(...args);};});
  await button(page,'Confirmar y reproducir exploración').click();await eventually(async()=>assert.equal(await page.evaluate(()=>window.__adaptiveWaiting),true));await page.evaluate(key=>{localStorage.setItem(key,'[]');window.__adaptiveRelease();},ADAPTIVE_KEY);await page.getByRole('alert').filter({hasText:'La evidencia cambió durante la confirmación'}).waitFor();assert.equal((await probe(page)).contexts.length,0);assert.equal((await storage(page))[ADAPTIVE_KEY],'[]');
});
test('Adaptive zero evidence keeps deterministic original order without inventing a best match',async t=>{
  const {page,raw}=await adaptiveFixtureUI(t,rows=>rows.forEach(p=>{p.assignments=p.assignments.map(a=>({index:a.index,candidateId:a.candidateId,status:'skipped',resolvedAt:a.resolvedAt}));}));const region=page.getByRole('region',{name:'Exploración adaptativa',exact:true});assert.match(await region.innerText(),/no establece aún una mejor señal/);assert.match(await region.innerText(),/Protocolo A · N = 0/);assert.match(await region.innerText(),/no-personal-evidence/);assert.equal((await probe(page)).contexts.length,0);assert.deepEqual(await storage(page),{[DISCOVERY_KEY]:raw});
});

for (const mobile of [false,true]) test(`3B.1 ${mobile?'mobile':'desktop'}: guided primary entry, separate Lab, unchanged URLs and no storage/audio side effects`,async t=>{
  const page=await fixture(t);if(mobile)await page.setViewportSize({width:390,height:844});await page.goto(harness.origin+'/');
  const entry=page.getByRole('navigation',{name:'Formas de explorar',exact:true});assert.equal(await entry.getByRole('link',{name:'Comenzar sesión guiada',exact:true}).getAttribute('href'),'/voz');
  assert.match(await entry.innerText(),/Describe lo que quieres explorar y Frequency Healer te propondrá una sesión\./);assert.match(await entry.innerText(),/El micrófono es opcional/);
  if(mobile)await button(page,'Menu').click();
  const nav=page.getByRole('navigation',{name:'Navegación principal',exact:true});
  const expected=[['Inicio','/'],['Sesión guiada','/voz'],['Laboratorio Armónico','/laboratorio-armonico'],['Atlas de frecuencias','/biblioteca'],['Protocolos históricos','/protocolos'],['Generador manual','/generador'],['Diario OBE','/diario'],['Exploración OBE','/sesion-nueva']];
  for(const [name,path] of expected)assert.equal(await nav.getByRole('link',{name,exact:true}).getAttribute('href'),path);
  await nav.getByRole('link',{name:'Sesión guiada',exact:true}).click();await page.waitForURL(harness.origin+'/voz');await page.getByRole('heading',{name:'Sesión guiada · tu privacidad',exact:true}).waitFor();assert.match(await page.locator('main').innerText(),/Puedes completar toda la sesión escribiendo/);
  assert.deepEqual(await storage(page),{});assert.equal((await probe(page)).contexts.length,0);
  if(mobile){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await button(page,'Menu').click();}
  await nav.getByRole('link',{name:'Laboratorio Armónico',exact:true}).click();await page.waitForURL(harness.origin+'/laboratorio-armonico');await field(page,'Base (Hz)').waitFor();assert.deepEqual(await storage(page),{});assert.equal((await probe(page)).contexts.length,0);
});
test('3B.1 text-only guided session works with microphone unavailable and keeps the existing proposal/storage contract',async t=>{
  const page=await fixture(t);await page.addInitScript(()=>{window.__micRequests=0;navigator.mediaDevices.getUserMedia=async()=>{window.__micRequests++;throw new DOMException('Microphone unavailable','NotAllowedError');};});
  await page.goto(harness.origin+'/');await page.getByRole('link',{name:'Comenzar sesión guiada',exact:true}).click();await button(page,'Entendido, continuar').click();await page.getByRole('heading',{name:'Sesión guiada',exact:true}).waitFor();await page.getByText('Puedes escribir tu intención o usar voz si lo prefieres. El micrófono es opcional.',{exact:true}).waitFor();
  const consent=await storage(page);assert.deepEqual(Object.keys(consent),['fh:voice-consent-v1']);await page.getByRole('textbox',{name:'¿Qué quieres explorar?',exact:true}).fill('Quiero concentrarme durante cinco minutos');await button(page,'Interpretar intención').click();await page.getByText('Cambiar interpretación',{exact:true}).click();await page.getByRole('combobox',{name:'Intensidad',exact:true}).selectOption('deep');await page.getByText('Ajustes armónicos avanzados',{exact:true}).click();await field(page,'Volumen inicial (0–100)').fill('0');await button(page,'Generar recomendación').click();assert.equal((await probe(page)).contexts.length,0);assert.deepEqual(await storage(page),consent);
  await button(page,'Continuar').click();await button(page,'Iniciar sesión').click();await button(page,'Detener sesión').waitFor();assert.deepEqual((await probe(page)).contexts.flatMap(c=>c.oscillators.map(o=>o.frequencies[0])),[224,336,224,336]);await button(page,'Detener sesión').click();await clean(page);assert.deepEqual(await storage(page),consent);await button(page,'Guardar sesión').click();await page.getByRole('status').filter({hasText:'Sesión guardada en este dispositivo.'}).waitFor();
  const saved=await storage(page);assert.deepEqual(Object.keys(saved).sort(),['fh:voice-consent-v1','fh:voice-sessions-v1'].sort());assert.equal(saved['fh:voice-consent-v1'],consent['fh:voice-consent-v1']);const [record]=JSON.parse(saved['fh:voice-sessions-v1']);assert.equal(record.schemaVersion,1);assert.equal(record.status,'stopped');assert.equal(record.proposal.ruleVersion,'voice-rules-v2');assert.equal(record.proposal.ruleId,'voice-focus-deep');assert.deepEqual(record.proposal.harmonicConfig,{baseHz:224,uiVolume:0,mode:'sequence',ratioId:'fifth',increments:3,direction:'return',waveform:'sine',durationSeconds:300,progression:['root','fifth','root','fifth']});assert.equal(record.proposal.seedSelection.seedRegistryVersion,'seed-registry-v1');assert.equal(record.proposal.proposalIdentity.seedSelectionVersion,'seed-selection-v1');assert.equal(await page.evaluate(()=>window.__micRequests),0);
});

async function guidedProposal(t,mobile=false){
  const page=await fixture(t);if(mobile)await page.setViewportSize({width:390,height:844});
  await page.goto(harness.origin+'/voz');await button(page,'Entendido, continuar').click();
  await page.getByRole('textbox',{name:'¿Qué quieres explorar?',exact:true}).fill('Quiero enfoque profundo 5 minutos');await button(page,'Interpretar intención').click();
  await page.getByText('Ajustes armónicos avanzados',{exact:true}).click();await field(page,'Volumen inicial (0–100)').fill('0');await button(page,'Generar recomendación').click();return page;
}
for(const mobile of [false,true])test(`3B.2 ${mobile?'mobile':'desktop'} linear journey, disclosures, back, explicit save and missing ratings`,async t=>{
  const page=await guidedProposal(t,mobile),before=await storage(page);
  assert.equal(await page.getByRole('region',{name:'Explicación del protocolo'}).isVisible(),false);
  await page.getByText('¿Por qué esta sesión?',{exact:true}).click();await page.getByText('Detalles de la recomendación',{exact:true}).click();assert.match(await page.getByRole('region',{name:'Explicación del protocolo'}).innerText(),/voice-focus-deep/);
  await page.getByText('¿Por qué esta sesión?',{exact:true}).click();await button(page,'Continuar').click();
  assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'Lista para comenzar');assert.equal((await probe(page)).contexts.length,0);
  await button(page,'Volver').click();await page.getByRole('heading',{name:'Sesión propuesta',exact:true}).waitFor();await button(page,'Continuar').click();await button(page,'Iniciar sesión').click();
  const stopButton=button(page,'Detener sesión');await stopButton.waitFor();const box=await stopButton.boundingBox();assert.ok(box.y>=0&&box.y+box.height<=(mobile?844:720));assert.equal(await field(page,'Base (Hz)').count(),0);
  await stopButton.click();await clean(page);assert.deepEqual(await storage(page),before);
  await page.getByRole('combobox',{name:'Claridad',exact:true}).selectOption('0');await button(page,'Guardar sesión').click();await page.getByRole('heading',{name:'Sesión guardada',exact:true}).waitFor();
  const [record]=JSON.parse((await storage(page))['fh:voice-sessions-v1']);assert.deepEqual(record.after,{clarity:0});assert.deepEqual(record.before,{});assert.equal(record.status,'stopped');
  await button(page,'Ver historial').click();assert.match(await page.evaluate(()=>document.activeElement?.textContent),/Historial de sesiones/);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await button(page,'Nueva sesión').click();await page.getByRole('heading',{name:'¿Qué quieres explorar hoy?',exact:true}).waitFor();assert.equal(await page.getByRole('textbox',{name:'¿Qué quieres explorar?',exact:true}).inputValue(),'');
});
test('3B.2 revised recommendation requires review and experimental consent at confirmation',async t=>{
  const page=await guidedProposal(t);await button(page,'Editar propuesta').click();await page.getByText('Cambiar interpretación',{exact:true}).click();await field(page,'Duración (minutos)').fill('7');await page.getByRole('combobox',{name:'Intensidad',exact:true}).selectOption('experimental');await button(page,'Generar recomendación').click();
  assert.equal(await button(page,'Iniciar sesión').count(),0);await button(page,'Continuar').click();const consent=page.getByRole('checkbox',{name:/Acepto explorar la cascada/});assert.equal(await consent.isVisible(),true);assert.equal(await button(page,'Iniciar sesión').isDisabled(),true);assert.equal((await probe(page)).contexts.length,0);await consent.check();
  await button(page,'Volver').click();await button(page,'Editar propuesta').click();await button(page,'Generar recomendación').click();await button(page,'Continuar').click();assert.equal(await consent.isChecked(),false);assert.equal(await button(page,'Iniciar sesión').isDisabled(),true);
  await consent.check();await button(page,'Iniciar sesión').click();await button(page,'Detener sesión').click();await clean(page);await button(page,'Guardar sesión').click();await page.getByRole('heading',{name:'Sesión guardada',exact:true}).waitFor();const [record]=JSON.parse((await storage(page))['fh:voice-sessions-v1']);assert.equal(record.proposal.harmonicConfig.durationSeconds,420);assert.equal(record.proposal.harmonicConfig.ratioId,'cascade-13-12');
});
test('3B.2 failed explicit save retains exportable memory draft and retries unchanged',async t=>{
  const page=await guidedProposal(t);await button(page,'Continuar').click();await button(page,'Iniciar sesión').click();await button(page,'Detener sesión').click();await clean(page);
  await page.evaluate(()=>{const original=Storage.prototype.setItem;window.__restoreSave=()=>{Storage.prototype.setItem=original;};Storage.prototype.setItem=function(k,v){if(k==='fh:voice-sessions-v1')throw new DOMException('Quota exceeded','QuotaExceededError');return original.call(this,k,v);};});
  await button(page,'Guardar sesión').click();await page.getByRole('alert').filter({hasText:'Sesión disponible en memoria para exportar'}).waitFor();assert.equal((await storage(page))['fh:voice-sessions-v1'],undefined);assert.equal(await page.getByText('Historial de sesiones',{exact:true}).evaluate(e=>e.parentElement.open),true);
  const download=page.waitForEvent('download');await button(page,'Exportar sesiones visibles').click();const stream=await(await download).createReadStream();let exported='';for await(const chunk of stream)exported+=chunk;const [draft]=JSON.parse(exported);assert.equal(draft.status,'stopped');
  await page.evaluate(()=>window.__restoreSave());await button(page,'Guardar sesión').click();await page.getByRole('heading',{name:'Sesión guardada',exact:true}).waitFor();assert.deepEqual(JSON.parse((await storage(page))['fh:voice-sessions-v1']),[draft]);
});
test('3B.2 unsaved navigation stops playback without persisting a completed record',async t=>{
  const page=await guidedProposal(t),before=await storage(page);await button(page,'Continuar').click();await button(page,'Iniciar sesión').click();await button(page,'Detener sesión').waitFor();await page.getByRole('link',{name:'Inicio',exact:true}).click();await page.waitForURL(harness.origin+'/');await clean(page);assert.deepEqual(await storage(page),before);
});
test('3B.3C legacy surfaces preserve data and require explicit playback',async t=>{
  const page=await fixture(t);
  await page.goto(harness.origin+'/biblioteca');await page.getByRole('heading',{name:'Atlas de frecuencias',exact:true}).waitFor();await page.getByText('40 resultados',{exact:true}).waitFor();assert.equal((await probe(page)).contexts.length,0);
  await page.locator('article').first().click();await page.getByText(/TRADICIONAL|EXPLORATORIO|LEGADO NO RESPALDADO/).first().waitFor();
  await page.goto(harness.origin+'/protocolos');await page.getByRole('heading',{name:'Protocolos históricos',exact:true}).waitFor();assert.ok(await page.getByText('DEPRECADO',{exact:true}).count()>0);assert.equal((await probe(page)).contexts.length,0);
  await page.goto(harness.origin+'/generador');await page.getByRole('heading',{name:'Generador manual',exact:true}).waitFor();await page.getByText('Configure · Configurar',{exact:true}).waitFor();await page.getByText('Review · Revisar',{exact:true}).waitFor();await page.getByText('Play · Reproducir',{exact:true}).waitFor();assert.equal((await probe(page)).contexts.length,0);
  await page.goto(harness.origin+'/voz');await button(page,'Entendido, continuar').click();await page.getByText('Historial de sesiones',{exact:true}).click();await page.getByRole('heading',{name:'Todavía no hay sesiones guardadas',exact:true}).waitFor();assert.deepEqual(Object.keys(await storage(page)),['fh:voice-consent-v1']);
});

for (const width of [390,768,1440]) test(`3B.3D OBE visual surfaces at ${width}px preserve contracts and fit viewport`,async t=>{
  const page=await fixture(t);await page.setViewportSize({width,height:900});
  await page.goto(harness.origin+'/sesion-nueva');await page.getByRole('heading',{name:'Exploración OBE',exact:true}).waitFor();await page.getByText('EXPLORATORIO',{exact:true}).waitFor();assert.equal((await probe(page)).contexts.length,0);assert.deepEqual(await storage(page),{});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.goto(harness.origin+'/biblioteca');await page.getByRole('button',{name:/Tarjetas de Comando/}).click();await page.getByText('Marco OBE exploratorio',{exact:true}).waitFor();assert.equal(await page.locator('.obe-command-card').count(),21);await page.locator('.obe-command-card').first().getByRole('button').click();await page.getByText('Propósito subjetivo',{exact:true}).first().waitFor();assert.equal(await page.getByText('Por qué funciona',{exact:true}).count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const legacy={id:'visual-obe',createdAt:1,sessionDate:'2026-09-20',focusLabel:'Focus 10',durationMinutes:30,paralysisAchieved:false,vibrations:true,separation:false,visualClarity:'partial',lookedBack:false,preEnergy:7,postEnergy:7,intention:'Explorar',notes:'Registro existente',tags:['legacy']};
  await page.evaluate(value=>localStorage.setItem('fh:obe-session-logs-v1',JSON.stringify([value])),legacy);await page.goto(harness.origin+'/diario');await page.getByRole('heading',{name:'Diario OBE',exact:true}).waitFor();await page.getByText('Focus 10',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.evaluate(()=>localStorage.setItem('fh:hemi-sync-disclaimer-accepted-v1','1'));await page.goto(harness.origin+'/generador');await page.getByRole('button',{name:/Acordes Multicapa/}).click();assert.equal((await probe(page)).contexts.length,0);await page.getByRole('button',{name:'Iniciar sesión binaural',exact:true}).click();const stop=page.getByRole('button',{name:'Detener sesión binaural',exact:true});await stop.waitFor();const box=await stop.boundingBox();assert.ok(box&&box.y>=0&&box.y+box.height<=900);await stop.click();await eventually(async()=>{const contexts=(await probe(page)).contexts;assert.ok(contexts.length>0);assert.ok(contexts.flatMap(c=>c.oscillators).every(o=>o.stops.length>0&&o.disconnected));});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
});
