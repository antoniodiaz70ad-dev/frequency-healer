import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileConstellation, type ConstellationInputV1 } from '../src/lib/harmonic/constellations';
import { assessBuilderPlayability, moveBuilderMember } from '../src/lib/harmonic/builder';
import { ConstellationStore, CONSTELLATIONS_KEY, type ConstellationLock } from '../src/lib/harmonic/constellationStorage';
import type { HarmonicConfig } from '../src/lib/harmonic/math';
const context: HarmonicConfig = { baseHz:432,ratioId:'fifth',increments:3,direction:'ascending',mode:'sequence',durationSeconds:60,uiVolume:0,waveform:'sine' };
const input: ConstellationInputV1 = {id:'builder-test',seedFrequencyHz:432,playbackMode:'sequence',members:[{id:'a',relationshipType:'root'},{id:'b',relationshipType:'ratio',ratio:{numerator:3,denominator:2}},{id:'c',relationshipType:'octave',octaveOffset:1}]};
const lock: ConstellationLock = async operation => operation();
function memory(raw?: string) {
  const data = new Map<string,string>([['fh:experiment-sessions-v1','old experiments'],['voice-key','old voice'],['obe-key','old diary']]);
  if(raw!==undefined)data.set(CONSTELLATIONS_KEY,raw);
  let writes=0;
  return {data,get writes(){return writes;},storage:{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{assert.equal(key,CONSTELLATIONS_KEY);writes++;data.set(key,value);}}};
}
test('builder: pure member add/remove/reorder, exact frequencies, multiplicity and signature semantics', async()=>{
  const original=await compileConstellation(input); assert.deepEqual(original.members.map(m=>m.frequencyHz),[432,648,864]);
  const duplicate=await compileConstellation({...input,members:[...input.members,{id:'d',relationshipType:'root'}]}); assert.equal(duplicate.members.length,4);
  const removed=await compileConstellation({...input,members:input.members.filter(m=>m.id!=='b')}); assert.deepEqual(removed.members.map(m=>m.frequencyHz),[432,864]);
  const reordered=moveBuilderMember(input.members,0,2); assert.deepEqual(input.members.map(m=>m.id),['a','b','c']);
  assert.notEqual((await compileConstellation({...input,members:reordered})).signature,original.signature);
  const simultaneous=await compileConstellation({...input,playbackMode:'simultaneous'});
  assert.equal((await compileConstellation({...input,playbackMode:'simultaneous',members:reordered})).signature,simultaneous.signature); assert.equal(simultaneous.playbackOrder,null);
  assert.equal((await compileConstellation({...input,name:'Another name'})).signature,original.signature);
  assert.equal((await compileConstellation(input)).signature,original.signature);
});
test('builder: compiler rejects invalid seed, duplicate IDs, invalid octave/derived member and overlong name',async()=>{
  for(const seedFrequencyHz of [NaN,Infinity,39,2001])await assert.rejects(compileConstellation({...input,seedFrequencyHz}));
  for(const seedFrequencyHz of [40,2000])assert.equal((await compileConstellation({...input,seedFrequencyHz,members:[input.members[0]]})).seedFrequencyHz,seedFrequencyHz);
  await assert.rejects(compileConstellation({...input,members:[input.members[0],input.members[0]]}));
  await assert.rejects(compileConstellation({...input,members:[{id:'x',relationshipType:'octave',octaveOffset:3}]}));
  await assert.rejects(compileConstellation({...input,members:[{id:'x',relationshipType:'octave',octaveOffset:0.5}]}));
  await assert.rejects(compileConstellation({...input,name:'x'.repeat(201)}));
  for(const [numerator,denominator] of [[1,1],[5,4],[6,5],[4,3],[3,2],[5,3],[2,1]])assert.equal((await compileConstellation({...input,members:[{id:'r',relationshipType:'ratio',ratio:{numerator,denominator}}]})).members[0].frequencyHz,432*numerator/denominator);
});
test('builder: exact structural compatibility uses V1 adapter without approximating octave or unsupported ratios',async()=>{
  for(const playbackMode of ['sequence','simultaneous'] as const){
    const known=await compileConstellation({...input,playbackMode,members:input.members.slice(0,2)});
    assert.equal((await assessBuilderPlayability(known,context)).status,'compatible');
  }
  assert.equal((await assessBuilderPlayability(await compileConstellation(input),context)).status,'partial');
  for(const members of [[input.members[2]],[{id:'r',relationshipType:'ratio' as const,ratio:{numerator:5,denominator:3}}],[{id:'r',relationshipType:'ratio' as const,ratio:{numerator:2,denominator:1}}]]){
    assert.equal((await assessBuilderPlayability(await compileConstellation({...input,members}),context)).status,'builder-only');
  }
  const many=await compileConstellation({...input,members:Array.from({length:10},(_,i)=>({id:String(i),relationshipType:'root' as const}))});
  assert.equal((await assessBuilderPlayability(many,context)).status,'partial');
});
test('constellation storage: explicit create/load roundtrip; duplicate IDs never replace; legacy keys untouched',async()=>{
  const mem=memory(),store=new ConstellationStore(mem.storage,lock),record=await compileConstellation(input);
  assert.deepEqual(await store.load(),[]); assert.equal(mem.writes,0);
  await store.create(record); assert.deepEqual(await store.load(),[record]);
  const raw=mem.data.get(CONSTELLATIONS_KEY); await assert.rejects(store.create(record));
  await assert.rejects(store.create(await compileConstellation({...input,name:'Changed'})));
  assert.equal(mem.data.get(CONSTELLATIONS_KEY),raw);assert.equal(mem.writes,1);
  for(const [key,value] of [['fh:experiment-sessions-v1','old experiments'],['voice-key','old voice'],['obe-key','old diary']])assert.equal(mem.data.get(key),value);
});
test('constellation storage: invalid data, bad signatures, duplicate persisted IDs and races preserve original bytes',async()=>{
  const record=await compileConstellation(input);
  for(const raw of ['{bad','{}',JSON.stringify([{...record,signature:'bad'}]),JSON.stringify([record,record])]){
    const mem=memory(raw),store=new ConstellationStore(mem.storage,lock);await assert.rejects(store.load());await assert.rejects(store.create(record));assert.equal(mem.data.get(CONSTELLATIONS_KEY),raw);assert.equal(mem.writes,0);
  }
  const mem=memory();const store=new ConstellationStore(mem.storage,lock);await assert.rejects(store.create({...record,members:[]}));assert.equal(mem.writes,0);
  let reads=0; const racing=new ConstellationStore({getItem:()=>++reads===1?'[]':'changed',setItem:()=>assert.fail('overwrite')},lock);await assert.rejects(racing.create(record),/Otra pestaña/);
});
test('builder: validation/status never access browser audio, storage or create experiments',async()=>{
  const keys=['AudioContext','webkitAudioContext','localStorage','sessionStorage','indexedDB'];
  const descriptors=keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)] as const);
  try { for(const k of keys)Object.defineProperty(globalThis,k,{configurable:true,get(){throw new Error(`Forbidden ${k}`);}});
    const record=await compileConstellation(input);assert.equal((await assessBuilderPlayability(record,context)).status,'partial');
  } finally {for(const [k,d] of descriptors){if(d)Object.defineProperty(globalThis,k,d);else Reflect.deleteProperty(globalThis,k);}}
});
test('constellation storage: serialized concurrent creates append; quota failure does not erase data',async()=>{
  const mem=memory();let queue=Promise.resolve();
  const serialized:ConstellationLock=operation=>{const pending=queue.then(operation);queue=pending.then(()=>{},()=>{});return pending;};
  const store=new ConstellationStore(mem.storage,serialized);
  const a=await compileConstellation({...input,id:'a'}),b=await compileConstellation({...input,id:'b'});
  await Promise.all([store.create(a),store.create(b)]);assert.deepEqual((await store.load()).map(r=>r.id),['a','b']);
  const raw=mem.data.get(CONSTELLATIONS_KEY);
  const quota=new ConstellationStore({getItem:mem.storage.getItem,setItem:()=>{throw new Error('quota');}},lock);
  await assert.rejects(quota.create(await compileConstellation({...input,id:'c'})),/quota/);assert.equal(mem.data.get(CONSTELLATIONS_KEY),raw);
});
