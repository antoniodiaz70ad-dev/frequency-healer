import assert from 'node:assert/strict';
import test from 'node:test';
import { compositionMix, validateComposition } from '../src/lib/marina/composer';
import { FIGURES, GEOMETRY_SOURCES, GEOMETRY_VERSION, defaultGeometry, flowerCenters, geometryRecipe, geometryTones, pentagonalPanels, practicePhaseAt, validateGeometry, validatePhaseMinutes } from '../src/lib/cymatics/geometry';
import { GEOMETRY_JOURNAL_KEY, addGeometryFollowUp, importGeometryJournal, parseGeometryJournal, readGeometryJournal, saveGeometryRecord, validateGeometryRecord, type GeometryRecord } from '../src/lib/cymatics/geometryJournal';
const immediate = async <T>(f:()=>T|Promise<T>)=>f();
const row=():GeometryRecord=>({version:GEOMETRY_VERSION,id:'practice-1',startedAt:'2026-11-23T12:00:00Z',endedAt:'2026-11-23T12:00:05Z',status:'stopped',elapsedMs:5000,config:defaultGeometry(),phaseMinutes:[2,2,4,2],soundEnabled:true,volume:.12,volumeChanges:[{elapsedMs:2000,volume:.1}],before:{valence:-2,activation:8,clarity:4},after:{valence:0,activation:4,clarity:7},intention:'Revisar con calma',thought:'Duda concreta',decision:'Comprobar datos',action:'Preparar un cálculo',observation:'Menor distracción',followUps:[]});
class Store { map=new Map<string,string>(); getItem(k:string){return this.map.get(k)??null;} setItem(k:string,v:string){this.map.set(k,v);} }
test('musical reasons produce exact same-channel carriers, bounded mix and validated recipes',()=>{
  const c=defaultGeometry(); assert.deepEqual(geometryTones(c),[256,384]);
  assert.deepEqual(geometryTones({...c,interval:'unison'}),[256]);
  assert.equal(geometryTones({...c,interval:'fourth'})[1],256*4/3);
  assert.equal(geometryTones({...c,interval:'sixth'})[1],256*5/3);
  assert.deepEqual(geometryTones({...c,baseHz:1000,interval:'octave'}),[1000,2000]);
  const recipe=geometryRecipe(c,10);validateComposition(recipe);
  assert.ok(recipe.layers.every(l=>l.mode==='tone'));assert.ok(compositionMix(recipe).reduce((s,l)=>s+l.gain,0)<=1);
  assert.throws(()=>validateGeometry({...c,baseHz:NaN}));assert.throws(()=>validateGeometry({...c,baseHz:1001}));assert.throws(()=>validateGeometry({...c,figure:'field-from-intention'}));
});
test('hexagonal flower and regular pentagons have measurable properties across opening settings',()=>{
  for(const n of [1,2,3]){const centers=flowerCenters(n);assert.equal(centers.length,1+3*n*(n+1));assert.equal(new Set(centers.map(p=>p.join(','))).size,centers.length);}
  for(const angle of [0,30,80])for(const polygon of pentagonalPanels(angle)){
    assert.equal(polygon.length,5);
    const sides=polygon.map((p,i)=>Math.hypot(...p.map((v,j)=>v-polygon[(i+1)%5][j])));
    assert.ok(sides.every(s=>Math.abs(s-sides[0])<1e-12));
  }
  const ids=new Set(GEOMETRY_SOURCES.map(s=>s.id));for(const figure of FIGURES)assert.ok(figure.sourceIds.every(id=>ids.has(id)));
});
test('custom phases preserve exact boundaries and reject skipped or non-finite durations',()=>{
  assert.deepEqual(validatePhaseMinutes([1,2,3,4]),[1,2,3,4]);
  assert.equal(practicePhaseAt([1,2,3,4],59999),0);assert.equal(practicePhaseAt([1,2,3,4],60000),1);assert.equal(practicePhaseAt([1,2,3,4],600000),-1);
  for(const value of [[0,2,3,4],[1.5,2,3,4],[1,2,3,NaN],[1,2,3]])assert.throws(()=>validatePhaseMinutes(value));
});
test('emotional diary saves explicit immutable snapshots, follow-ups and unrelated keys unchanged',async()=>{
  const store=new Store();store.setItem('fh.marina.sessions.v1','protected');const input=row();
  await saveGeometryRecord(input,store,immediate);input.config.baseHz=400;
  assert.equal(readGeometryJournal(store)[0].config.baseHz,256);
  const count=await saveGeometryRecord(row(),store,immediate);assert.equal(count.length,1);
  await addGeometryFollowUp('practice-1',{at:'2026-11-23T12:01:00Z',text:'Acción realizada'},store,immediate);
  const saved=readGeometryJournal(store)[0];assert.equal(saved.before.valence,-2);assert.equal(saved.after.clarity,7);assert.equal(saved.followUps.length,1);assert.equal(store.getItem('fh.marina.sessions.v1'),'protected');
});
test('portable import is idempotent and conflicts, unknown fields and damaged history cannot overwrite',async()=>{
  const store=new Store(),first=row();await saveGeometryRecord(first,store,immediate);
  await importGeometryJournal(JSON.stringify([first]),store,immediate);assert.equal(readGeometryJournal(store).length,1);
  const reordered=Object.fromEntries(Object.entries(first).reverse());
  await importGeometryJournal(JSON.stringify([reordered]),store,immediate);assert.equal(readGeometryJournal(store).length,1);
  const original=store.getItem(GEOMETRY_JOURNAL_KEY);
  await assert.rejects(importGeometryJournal(JSON.stringify([{...first,action:'Conflicto'}]),store,immediate),/diferente/);
  assert.equal(store.getItem(GEOMETRY_JOURNAL_KEY),original);
  assert.throws(()=>validateGeometryRecord({...first,externalAction:'send'}));
  store.setItem(GEOMETRY_JOURNAL_KEY,'{invalid');await assert.rejects(saveGeometryRecord({...first,id:'new'},store,immediate),/dañado/);assert.equal(store.getItem(GEOMETRY_JOURNAL_KEY),'{invalid');
});
test('bad timings, ratings, volume history and quota failures remain explicit and recoverable',async()=>{
  for(const update of [{elapsedMs:600001},{status:'completed'},{after:{valence:6,activation:4,clarity:5}},{volumeChanges:[{elapsedMs:6000,volume:.2}]},{followUps:[{at:'2026-11-23T11:00:00Z',text:'antes'}]}])assert.throws(()=>validateGeometryRecord({...row(),...update}));
  const store=new Store();store.setItem(GEOMETRY_JOURNAL_KEY,'[]');store.setItem=()=>{throw new Error('QuotaExceeded');};
  await assert.rejects(saveGeometryRecord(row(),store,immediate),/Exporta/);assert.equal(store.getItem(GEOMETRY_JOURNAL_KEY),'[]');
  assert.throws(()=>parseGeometryJournal('x'.repeat(5_000_001)),/5 MB/);
});
test('serialized concurrent saves read the latest diary and retain both records',async()=>{
  const store=new Store();let tail=Promise.resolve();
  const lock=<T>(f:()=>T|Promise<T>)=>{const result=tail.then(f);tail=result.then(()=>undefined,()=>undefined);return result;};
  await Promise.all([saveGeometryRecord(row(),store,lock),saveGeometryRecord({...row(),id:'practice-2'},store,lock)]);
  assert.equal(readGeometryJournal(store).length,2);
});
