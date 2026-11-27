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
 await page.getByRole('radio',{name:'Calmarme · Punto Cero 7.8',exact:true}).check();assert.equal(await page.getByLabel('Duración de la práctica',{exact:true}).inputValue(),'6');
 await page.getByRole('button',{name:'Comenzar práctica',exact:true}).click();await page.getByRole('button',{name:'Pausar práctica',exact:true}).waitFor();await page.getByRole('link',{name:'Estudiar',exact:true}).click();
 await eventually(async()=>{data=await page.evaluate(()=>window.__fhUI.snapshot());assert.ok(data.contexts.every(c=>c.state==='closed'));});assert.deepEqual(data.writes,[]);
});
test('Marina 12-minute practice cannot enable empty Arthur narration', {timeout:45000},async t=>{
 const context=await harness.browser.newContext();t.after(()=>context.close());const page=await context.newPage();await page.goto(harness.origin+'/marina-punto-cero');
 await page.getByRole('combobox',{name:/Elegir práctica/}).selectOption('creation12');
 assert.equal(await page.getByLabel('Voz de la guía',{exact:true}).inputValue(),'');assert.equal(await page.getByLabel('Leer instrucciones con voz',{exact:true}).isDisabled(),true);
 await page.getByLabel('Voz de la guía',{exact:true}).selectOption('device');assert.equal(await page.getByLabel('Leer instrucciones con voz',{exact:true}).isEnabled(),true);
});
