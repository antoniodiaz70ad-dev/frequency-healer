import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSummary, selectSummary, acceptSummaryEvent, validateFollowup, classifyReplay } from './contract.mjs';
const id = '11111111-1111-4111-8111-111111111111';
const channel = '22222222-2222-4222-8222-222222222222';
const base = () => ({schemaVersion:1,source:'frequency-healer',practice:'bentov',sessionId:id,protocolVersion:'bentov-respiration-v1.1',startedAt:'2026-10-24T12:00:00.000Z',endedAt:'2026-10-24T12:10:00.000Z',elapsedActiveMs:600000,status:'completed',mode:'paced',interruptionCount:0,shared:{observation:true,interpretation:false,action:true,scores:true},observation:'Observación sintética.',interpretation:null,action:'Acción sintética.',scores:{tensionPre:0,tensionPost:null,clarityPre:5,clarityPost:7}});
test('preserva cero, omisión, texto y copia independiente',()=>{const x=base(); const y=validateSummary(x); assert.deepEqual(x,y);y.scores.tensionPre=9;assert.equal(x.scores.tensionPre,0);assert.equal(y.scores.tensionPost,null);});
const invalid = {
  'versión desconocida': x=>x.schemaVersion=2,
  'campo extraño': x=>x.user_id=id,
  'campo ausente': x=>delete x.action,
  'uuid inválido': x=>x.sessionId='sesion',
  'fecha imposible': x=>x.startedAt='2026-02-30T12:00:00.000Z',
  'fecha sin zona': x=>x.startedAt='2026-10-24T12:00:00',
  'fin anterior': x=>x.endedAt='2026-10-24T11:00:00.000Z',
  'tiempo activo superior al real': x=>x.endedAt='2026-10-24T12:09:00.000Z',
  'duración negativa': x=>x.elapsedActiveMs=-1,
  'duración excesiva': x=>x.elapsedActiveMs=600001,
  'duración fraccional': x=>x.elapsedActiveMs=1.5,
  'completada demasiado breve': x=>x.elapsedActiveMs=1000,
  'modo inventado': x=>x.mode='quantum',
  'estado inventado': x=>x.status='healed',
  'interrupciones negativas': x=>x.interruptionCount=-1,
  'selección textual': x=>x.shared.action='true',
  'texto no autorizado': x=>x.interpretation='No compartir',
  'escalas no autorizadas': x=>x.shared.scores=false,
  'escala negativa': x=>x.scores.tensionPre=-1,
  'escala excesiva': x=>x.scores.clarityPost=11,
  'escala como string': x=>x.scores.tensionPre='0',
  'escala NaN': x=>x.scores.tensionPre=NaN,
  'escala omitida como undefined': x=>x.scores.tensionPre=undefined,
  'escala extra': x=>x.scores.resonance=7,
  'texto excesivo': x=>x.action='a'.repeat(5001),
  'objeto donde hay texto': x=>x.action={secret:'no'},
  'límite UTF8': x=>{x.shared.interpretation=true;x.observation='漢'.repeat(5000);x.interpretation='漢'.repeat(5000);x.action='漢'.repeat(5000);},
};
for (const [name, mutate] of Object.entries(invalid)) test(`rechaza ${name}`,()=>{const x=base();mutate(x);assert.throws(()=>validateSummary(x));});
test('detenida e interrumpida mantienen su estado',()=>{for(const status of ['stopped','interrupted']){const x=base();x.status=status;x.elapsedActiveMs=1000;assert.equal(validateSummary(x).status,status);}});
test('mezcla y pausas no se convierten en sesión comparable',()=>{const x=base();x.mode='mixed';x.interruptionCount=2;assert.equal(validateSummary(x).interruptionCount,2);});
test('selección excluye material no elegido y datos adicionales locales',()=>{const b=base();const local={...b,id,actualMode:'paced',interruptions:[],observation:'visible',interpretation:'privada',action:'privada',tensionPre:0,tensionPost:null,clarityPre:5,clarityPost:7,secret:'privado'};const x=selectSummary(local,{observation:true,interpretation:false,action:false,scores:false});assert.equal(x.interpretation,null);assert.equal(x.action,null);assert.equal(x.scores,null);assert.ok(!JSON.stringify(x).includes('privad'));});
test('selección no inventa respuestas faltantes',()=>{assert.throws(()=>selectSummary({id,interruptions:[]},{observation:false,interpretation:false,action:false,scores:false}));});
const expected=()=>({window:{},origin:'https://practice.example',flowId:id,channel,expiresAt:2000,now:1000});
const message=e=>({source:e.window,origin:e.origin,data:{type:'fh.summary',version:1,flowId:id,channel,summary:base()}});
test('acepta solo canal y ventana esperados',()=>{const e=expected();assert.deepEqual(acceptSummaryEvent(message(e),e),base());});
for (const [name, mutate] of Object.entries({
  'origen ajeno':(m,e)=>m.origin='https://other.example',
  'ventana ajena':(m,e)=>m.source={},
  'sin ventana':(m,e)=>{m.source=null;e.window=null;},
  'canal distinto':m=>m.data.channel=id,
  'flujo distinto':m=>m.data.flowId=channel,
  'caducado':(m,e)=>e.now=e.expiresAt,
  'hora ausente':(m,e)=>delete e.now,
  'http':(m,e)=>{m.origin='http://practice.example';e.origin=m.origin;},
  'origen con ruta':(m,e)=>{m.origin='https://practice.example/path';e.origin=m.origin;},
  'tipo distinto':m=>m.data.type='fh.saved',
  'versión distinta':m=>m.data.version=2,
  'resumen inválido':m=>m.data.summary.scores.tensionPre=99,
})) test(`mensaje rechaza ${name}`,()=>{const e=expected();const m=message(e);mutate(m,e);assert.throws(()=>acceptSummaryEvent(m,e));});
test('seguimiento exige revisión y nueva acción al cambiar',()=>{const x={expectedRevision:0,status:'pending',observation:null,nextAction:null};assert.deepEqual(validateFollowup(x),x);assert.throws(()=>validateFollowup({...x,expectedRevision:-1}));assert.throws(()=>validateFollowup({...x,status:'changed'}));assert.equal(validateFollowup({...x,status:'changed',nextAction:'Probar otra acción'}).status,'changed');});
test('reintento idéntico no pide otra inserción',()=>assert.equal(classifyReplay(base(),base()),'same'));
test('orden de las claves no cambia el reintento',()=>{const x=Object.fromEntries(Object.entries(base()).reverse());x.scores=Object.fromEntries(Object.entries(x.scores).reverse());assert.equal(classifyReplay(base(),x),'same');});
test('mismo identificador con otro texto requiere conflicto',()=>{const x=base();x.action='Otra acción';assert.equal(classifyReplay(base(),x),'conflict');});
test('sesiones diferentes no son un reintento',()=>{const x=base();x.sessionId=channel;assert.throws(()=>classifyReplay(base(),x));});
