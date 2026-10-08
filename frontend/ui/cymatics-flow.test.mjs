import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { startHarness, observeBrowser, eventually } from './browser-harness.mjs';

let harness;
before(async()=>{harness=await startHarness();},{timeout:60000});
after(async()=>{await harness?.close();},{timeout:15000});
async function fixture(t){const context=await harness.browser.newContext();t.after(()=>context.close());await context.addInitScript(observeBrowser);const page=await context.newPage();page.setDefaultTimeout(8000);await page.goto(harness.origin+'/laboratorio-cimatico?frequency=432&waveform=sine&binaural=8');return page;}

test('cymatics route: generator parameters, independent binaural views and shared existing audio graph', {timeout:45000}, async t=>{
  const page=await fixture(t);assert.equal(await page.getByRole('spinbutton',{name:'Frecuencia cimática'}).inputValue(),'432');assert.equal(await page.getByRole('img',{name:'Canal izquierdo'}).count(),1);assert.equal(await page.getByRole('img',{name:'Canal derecho'}).count(),1);assert.match(await page.getByText(/Diferencia:/).first().innerText(),/8.0 Hz; no es un tono emitido/);
  await page.getByRole('button',{name:'Escuchar tono'}).click();let probe=await page.evaluate(()=>window.__fhUI.snapshot());assert.deepEqual(probe.contexts.flatMap(c=>c.oscillators.map(o=>o.frequencies[0])),[432,440]);await page.getByRole('button',{name:'Detener sonido'}).click();await eventually(async()=>{probe=await page.evaluate(()=>window.__fhUI.snapshot());assert.ok(probe.contexts[0].oscillators.every(o=>o.ended&&o.disconnected));});
});

test('cymatics route: surface switch, A/B, explicit gallery save and reload', {timeout:45000}, async t=>{
  const page=await fixture(t);await page.getByRole('combobox',{name:'Superficie'}).selectOption('circular-membrane');await page.getByRole('button',{name:'Guardar A'}).click();await page.getByRole('spinbutton',{name:'Frecuencia cimática'}).fill('528');await page.getByRole('button',{name:'Guardar B'}).click();await page.getByRole('button',{name:'Comparar'}).click();assert.equal(await page.getByRole('img',{name:'Comparación A'}).count(),1);assert.equal(await page.getByRole('img',{name:'Comparación B'}).count(),1);assert.match(await page.getByText(/escala visual común/).innerText(),/Superficie física idéntica/);
  await page.getByRole('button',{name:'Guardar figura'}).click();await page.getByRole('heading',{name:'Galería local (1)'}).waitFor();const storage=await page.evaluate(()=>({...localStorage}));assert.equal(Object.keys(storage).length,1);assert.ok(storage['fh:cymatics-gallery-v1']);await page.reload();await page.getByRole('heading',{name:'Galería local (1)'}).waitFor();assert.equal((await page.evaluate(()=>window.__fhUI.snapshot())).contexts.length,0);
});
