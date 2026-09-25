import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileConstellation } from '../src/lib/harmonic/constellations';
import { planConstellationPlayback } from '../src/lib/harmonic/constellationPlayback';
import { prepareExperiment, validateExperiment } from '../src/lib/experiments/validation';
import { ExperimentStore, EXPERIMENTS_KEY } from '../src/lib/experiments/storage';
import { prepareExperimentV2, validateExperimentV2, validateAuditableExperiment, transitionExperimentV2 } from '../src/lib/experiments/v2';
import { ExperimentStoreV2, EXPERIMENTS_V2_KEY, type ExperimentV2Lock } from '../src/lib/experiments/storageV2';
import type { HarmonicConfig } from '../src/lib/harmonic/math';
const context:HarmonicConfig={baseHz:432,ratioId:'fifth',increments:3,direction:'ascending',mode:'sequence',durationSeconds:60,uiVolume:0,waveform:'sine'};
const at='2026-09-20T00:00:00.000Z';
async function fixture(){const constellation=await compileConstellation({id:'saved-identity',name:'Original name',seedFrequencyHz:432,playbackMode:'sequence',members:[{id:'f',relationshipType:'ratio',ratio:{numerator:3,denominator:2}},{id:'r1',relationshipType:'root'},{id:'r2',relationshipType:'root'}]});const plan=await planConstellationPlayback(constellation,context);return {constellation,plan,record:await prepareExperimentV2(plan.config,{preState:{clarity:0},expectationScore:0},constellation,'experiment-v2',at)};}
const lock:ExperimentV2Lock=async operation=>operation();
test('V1 remains V1, loads unchanged and never mixes with V2 namespace',async()=>{
  const legacy=prepareExperiment(context,{preState:{}},'legacy',at),raw=JSON.stringify([legacy]);const data=new Map([[EXPERIMENTS_KEY,raw]]);const store={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{assert.equal(key,EXPERIMENTS_V2_KEY);data.set(key,value);}};
  assert.deepEqual(await validateAuditableExperiment(legacy),validateExperiment(legacy));assert.deepEqual(new ExperimentStore(store).load(),[legacy]);
  await new ExperimentStoreV2(store,lock).save((await fixture()).record);assert.equal(data.get(EXPERIMENTS_KEY),raw);assert.deepEqual(new ExperimentStore(store).load(),[legacy]);
  await assert.rejects(validateExperimentV2(legacy));assert.throws(()=>validateExperiment(({} as unknown)));
});
test('V2 retains detached immutable identity, definition and exact acoustic snapshot before awaits',async()=>{
  const {record,plan,constellation}=await fixture();const input=structuredClone(record),pending=validateExperimentV2(input);Object.assign(input.constellation!.snapshot,{name:'Changed while validating'});Object.assign(input.configurationSnapshot,{uiVolume:100});
  const audited=await pending;assert.equal(audited.constellation!.snapshot.name,'Original name');assert.deepEqual(audited.configurationSnapshot,plan.config);assert.equal(audited.constellation!.signature,constellation.signature);assert.notEqual(audited.constellation!.snapshot,constellation);
  for(const value of [audited,audited.configurationSnapshot,audited.configurationSnapshot.progression,audited.constellation,audited.constellation!.snapshot,audited.constellation!.snapshot.members,audited.constellation!.snapshot.members[0]])assert.ok(Object.isFrozen(value));
  assert.equal(audited.expectationScore,0);assert.equal(audited.preState.clarity,0);assert.equal(audited.preState.focus,undefined);assert.equal(audited.reflection,undefined);
});
test('V2 remains auditable if source is renamed, replaced or removed; export/reload exact',async()=>{
  const {record,constellation}=await fixture();const source=new Map([[constellation.id,structuredClone(constellation)]]);Object.assign(source.get(constellation.id)!,{name:'Renamed'});source.delete(constellation.id);
  const data=new Map<string,string>();const store=new ExperimentStoreV2({getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)},lock);
  await store.save(record);const exported=await store.exportJSON();assert.deepEqual(JSON.parse(exported),[record]);assert.deepEqual(await store.load(),[record]);assert.equal((await store.load())[0].constellation!.snapshot.name,'Original name');assert.deepEqual(await validateAuditableExperiment(JSON.parse(exported)[0]),record);
});
test('V2 rejects corrupted identity, signature, definition, acoustic config and unknown fields',async()=>{
  const {record}=await fixture();for(const patch of [{id:'other'},{signature:'sha256:bad'},{generationVersion:'future'}])await assert.rejects(validateExperimentV2({...record,constellation:{...record.constellation,...patch}}));
  const bad=structuredClone(record);Object.assign(bad.constellation!.snapshot.members[0],{frequencyHz:999});await assert.rejects(validateExperimentV2(bad));
  for(const patch of [{baseHz:400},{ratioId:'fifth'},{increments:2},{direction:'descending'},{mode:'simultaneous'},{progression:['root','fifth','root']}])await assert.rejects(validateExperimentV2({...record,configurationSnapshot:{...record.configurationSnapshot,...patch}}));
  await assert.rejects(validateExperimentV2({...record,unknown:true}));assert.throws(()=>validateExperiment(record));
});
test('V2 lifecycle reuses V1 rules; cancelled/interrupted never become completed',async()=>{
  const {record}=await fixture();assert.equal(transitionExperimentV2(record,'interrupted',at),record);
  const started=transitionExperimentV2(record,'started',at);assert.equal(started.status,'started');
  for(const status of ['cancelled','interrupted','completed'] as const){const ended=transitionExperimentV2(started,status,at);assert.equal(ended.status,status);assert.equal(ended.completedAt,status==='completed'?at:undefined);assert.equal(transitionExperimentV2(ended,'completed',at),ended);assert.deepEqual(await validateExperimentV2(ended),ended);}
  await assert.rejects(validateExperimentV2({...record,status:'completed',completedAt:at}));
});
test('V2 storage corruption and duplicate IDs never overwrite bytes; wrong version rejected',async()=>{
  const {record}=await fixture();for(const raw of ['{bad','{}',JSON.stringify([record,record]),JSON.stringify([{...record,schemaVersion:1}])]){let writes=0;const store=new ExperimentStoreV2({getItem:()=>raw,setItem:()=>{writes++;}},lock);await assert.rejects(store.load());await assert.rejects(store.save(record));assert.equal(writes,0);}
  let raw=JSON.stringify([record]),writes=0;const store=new ExperimentStoreV2({getItem:()=>raw,setItem:(_key,value)=>{raw=value;writes++;}},lock);await store.save(record);assert.equal(writes,0);await assert.rejects(store.save({...record,reflection:'conflicting'}));assert.equal(writes,0);
  let reads=0;const race=new ExperimentStoreV2({getItem:()=>++reads===1?'[]':'changed',setItem:()=>assert.fail('race overwrite')},lock);await assert.rejects(race.save(record),/cambió/);
});
test('V2 optional link stays absent; locked concurrent appends and quota failure preserve data',async()=>{
  const unlinked=await prepareExperimentV2(context,{preState:{}},undefined,'unlinked',at);assert.equal(unlinked.constellation,undefined);assert.deepEqual(await validateExperimentV2(unlinked),unlinked);
  const {record}=await fixture();const data=new Map<string,string>();let queue=Promise.resolve();const serial:ExperimentV2Lock=operation=>{const pending=queue.then(operation);queue=pending.then(()=>{},()=>{});return pending;};
  const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};const store=new ExperimentStoreV2(storage,serial);await Promise.all([store.save(record),store.save(unlinked)]);assert.equal((await store.load()).length,2);
  const raw=data.get(EXPERIMENTS_V2_KEY);const quota=new ExperimentStoreV2({getItem:storage.getItem,setItem:()=>{throw new Error('quota');}},lock);await assert.rejects(quota.save({...unlinked,id:'third'}),/quota/);assert.equal(data.get(EXPERIMENTS_V2_KEY),raw);
});
