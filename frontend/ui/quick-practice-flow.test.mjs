import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {startHarness,observeBrowser,eventually} from './browser-harness.mjs';
let harness;
before(async()=>{harness=await startHarness();},{timeout:60000});
after(async()=>{await harness?.close();});
test('quick practice: preview, pause, resume, recipe switch and navigation never write records', {timeout:45000}, async t=>{
 const context=await harness.browser.newContext({viewport:{width:390,height:844}});t.after(()=>context.close());
 await context.addInitScript(observeBrowser);const page=await context.newPage();await page.goto(harness.origin+'/practicar');
 await page.getByRole('button',{name:'Escuchar muestra · 15 s',exact:true}).click();await page.getByRole('status').filter({hasText:'Muestra ·'}).waitFor();
 await page.getByRole('status').filter({hasText:'Muestra terminada.'}).waitFor({timeout:20000});
 await page.getByRole('button',{name:'Escuchar muestra · 15 s',exact:true}).click();await page.getByRole('status').filter({hasText:'Muestra ·'}).waitFor();
 let data=await page.evaluate(()=>window.__fhUI.snapshot());assert.deepEqual(data.writes,[]);
 await page.getByRole('button',{name:'Comenzar práctica',exact:true}).click();await page.getByRole('button',{name:'Pausar práctica',exact:true}).click();await page.getByRole('button',{name:'Reanudar práctica',exact:true}).click();await page.getByRole('button',{name:'Pausar práctica',exact:true}).waitFor();
 await page.getByRole('radio',{name:'Calmarme · Punto Cero 7.8',exact:true}).check();await page.getByRole('button',{name:'Descartar borrador',exact:true}).click();assert.equal(await page.getByLabel('Duración de la práctica',{exact:true}).inputValue(),'6');
 await page.getByRole('button',{name:'Comenzar práctica',exact:true}).click();await page.getByRole('button',{name:'Pausar práctica',exact:true}).waitFor();await page.getByRole('link',{name:'Estudiar',exact:true}).click();
 await eventually(async()=>{data=await page.evaluate(()=>window.__fhUI.snapshot());assert.ok(data.contexts.every(c=>c.state==='closed'));});assert.deepEqual(data.writes,[]);
});
test('Marina 12-minute practice cannot enable empty Arthur narration', {timeout:45000},async t=>{
 const context=await harness.browser.newContext();t.after(()=>context.close());const page=await context.newPage();await page.goto(harness.origin+'/marina-punto-cero');
 await page.getByRole('combobox',{name:/Elegir práctica/}).selectOption('creation12');
 assert.equal(await page.getByLabel('Voz de la guía',{exact:true}).inputValue(),'');assert.equal(await page.getByLabel('Leer instrucciones con voz',{exact:true}).isDisabled(),true);
 await page.getByLabel('Voz de la guía',{exact:true}).selectOption('device');assert.equal(await page.getByLabel('Leer instrucciones con voz',{exact:true}).isEnabled(),true);
});

 test('saved versions survive reload; loading is silent and explicit practice preserves original snapshot', {timeout:45000},async t=>{
 const context=await harness.browser.newContext();t.after(()=>context.close());await context.addInitScript(observeBrowser);const page=await context.newPage();await page.goto(harness.origin+'/practicar');
 await page.getByLabel('Duración de la práctica',{exact:true}).selectOption('15');await page.getByLabel('Nombre de la versión',{exact:true}).fill('Foco revisión');await page.getByRole('button',{name:'Guardar versión',exact:true}).click();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('fh.practice.records.v1')));assert.equal(saved.versions.length,1);assert.equal(saved.sessions.length,0);
 await page.reload();await page.getByRole('button',{name:'Cargar Foco revisión',exact:true}).click();assert.equal(await page.getByLabel('Duración de la práctica',{exact:true}).inputValue(),'15');assert.equal((await page.evaluate(()=>window.__fhUI.snapshot())).contexts.length,0);
 await page.getByRole('button',{name:'Comenzar práctica',exact:true}).click();await page.getByRole('button',{name:'Pausar práctica',exact:true}).waitFor();await page.getByRole('button',{name:'Detener audio',exact:true}).click();await page.getByLabel('Observación de la práctica',{exact:true}).fill('Una prueba de atención.');await page.getByRole('button',{name:'Guardar práctica',exact:true}).click();
 const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('fh.practice.records.v1')));assert.equal(data.sessions.length,1);assert.equal(data.sessions[0].status,'stopped');assert.equal(data.sessions[0].versionId,saved.versions[0].id);assert.deepEqual(data.sessions[0].recipe,saved.versions[0].recipe);assert.equal(data.sessions[0].initialVolume,saved.versions[0].volume);assert.equal(data.sessions[0].experience,'Una prueba de atención.');
 await page.getByRole('link',{name:'Mis registros',exact:true}).click();await page.getByRole('link',{name:/Mis prácticas rápidas/}).waitFor();
 });
