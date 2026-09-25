import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inverseHarmonicConfig, proposeRelationshipApply, applyRatioId } from '../src/lib/harmonic/apply';
import { adaptHarmonicConfig } from '../src/lib/harmonic/adapter';
import { compileConstellation } from '../src/lib/harmonic/constellations';
import { buildSchedule, RATIOS, type HarmonicConfig, type RatioId } from '../src/lib/harmonic/math';
import { prepareExperiment, transitionExperiment, validateExperiment } from '../src/lib/experiments/validation';
import { ExperimentStore, EXPERIMENTS_KEY } from '../src/lib/experiments/storage';
const base: HarmonicConfig = { baseHz: 432, ratioId: 'fourth', mode: 'sequence', durationSeconds: 300, uiVolume: 20, waveform: 'sine', increments: 3, direction: 'ascending' };
const ids = ['root', 'fifth', 'fourth', 'major-third', 'minor-third'] as const;

test('inverse: exact full-config roundtrip for all five intervals, both modes and preserved session fields', async () => {
  for (const ratioId of ids) for (const mode of ['sequence', 'simultaneous'] as const)
    for (const baseHz of [40, 432.123456789, 1000]) for (const durationSeconds of [1, 3600])
      for (const uiVolume of [0, 100]) for (const direction of ['ascending', 'descending', 'return'] as const) {
        const config = { ...base, ratioId, mode, baseHz, durationSeconds, uiVolume, direction, increments: 8 };
        const forward = await adaptHarmonicConfig(config); assert.equal(forward.status, 'supported'); if (forward.status !== 'supported') return;
        const back = await inverseHarmonicConfig(forward.constellation, config); assert.equal(back.status, 'supported'); if (back.status !== 'supported') return;
        assert.deepEqual(back.config, config); assert.deepEqual(buildSchedule(back.config), forward.schedule);
        assert.deepEqual((await adaptHarmonicConfig(back.config)), forward);
      }
});

test('apply: every authorized relationship changes only ratioId; select never mutates input', async () => {
  for (const mode of ['sequence', 'simultaneous'] as const) for (const id of ids) {
    const context = { ...base, mode }; const before = structuredClone(context); const r = RATIOS[id];
    assert.equal(applyRatioId({ numerator: r.p, denominator: r.q }), id);
    const result = await proposeRelationshipApply({ numerator: r.p, denominator: r.q }, context);
    assert.equal(result.status, 'supported'); if (result.status !== 'supported') return;
    assert.deepEqual(context, before); assert.deepEqual(result.config, { ...context, ratioId: id });
    assert.deepEqual(buildSchedule(result.config), buildSchedule({ ...context, ratioId: id }));
    const back = await inverseHarmonicConfig(result.constellation, context);
    assert.deepEqual(back, result); assert.ok(Object.isFrozen(result.config));
  }
  const root = await proposeRelationshipApply({ numerator: 1, denominator: 1 }, base);
  assert.equal(root.status, 'supported'); if (root.status === 'supported') assert.deepEqual(buildSchedule(root.config).steps.flatMap(s => s.frequencies), [432, 432]);
});

test('inverse: explicit existing progression roundtrips but may not be replaced, reordered or extended', async () => {
  for (const mode of ['sequence', 'simultaneous'] as const) for (const progression of [['fifth'], ['root','root'], ['fifth','root','minor-third','fifth'], Array(9).fill('root')] as RatioId[][]) {
    const config = { ...base, mode, progression }; const forward = await adaptHarmonicConfig(config);
    assert.equal(forward.status, 'supported'); if (forward.status !== 'supported') return;
    const back = await inverseHarmonicConfig(forward.constellation, config);
    assert.equal(back.status, 'supported'); if (back.status === 'supported') { assert.deepEqual(back.config, config); assert.deepEqual(buildSchedule(back.config), buildSchedule(config)); }
    assert.equal((await proposeRelationshipApply({ numerator: 3, denominator: 2 }, config)).status, 'unsupported');
    const changed = await adaptHarmonicConfig({ ...config, progression: ['root','fifth'] });
    if (changed.status === 'supported') assert.equal((await inverseHarmonicConfig(changed.constellation, config)).status, 'unsupported');
  }
});

test('inverse: never applies arbitrary/custom constellations, octaves, renamed IDs, extra members, seed or mode changes', async () => {
  const forward = await adaptHarmonicConfig(base); assert.equal(forward.status, 'supported'); if (forward.status !== 'supported') return;
  for (const input of [
    { seedFrequencyHz: 864, playbackMode: base.mode, members: [{ id:'a', relationshipType:'root' as const }] },
    { seedFrequencyHz: 432, playbackMode: base.mode, members: [{ id:'a', relationshipType:'root' as const }, { id:'b', relationshipType:'octave' as const, octaveOffset:1 }] },
    { seedFrequencyHz: 432, playbackMode: base.mode, members: [{ id:'a', relationshipType:'root' as const }, { id:'b', relationshipType:'octave' as const, octaveOffset:0 }] },
    { seedFrequencyHz: 432, playbackMode: base.mode, members: [{ id:'a', relationshipType:'root' as const }, { id:'b', relationshipType:'ratio' as const, ratio:{numerator:5,denominator:3} }] },
    { seedFrequencyHz: 432, playbackMode: base.mode, members: Array.from({length:3},(_,i)=>({id:`x${i}`,relationshipType:'root' as const})) },
  ]) assert.equal((await inverseHarmonicConfig(await compileConstellation(input), base)).status, 'unsupported');
  for (const patch of [{ id:'custom' },{name:'custom'}, {playbackMode:'simultaneous' as const}]) {
    const defs=forward.constellation.members.map(m=>{const {frequencyHz,...rest}=m; void frequencyHz; return rest;});
    const custom=await compileConstellation({seedFrequencyHz:432,playbackMode:base.mode,members:defs,...patch});
    assert.equal((await inverseHarmonicConfig(custom,base)).status,'unsupported');
  }
});

test('apply: unsupported relationships and cascade context are explicit; no approximations or inferred defaults', async () => {
  for (const [numerator,denominator] of [[5,3],[2,1],[13,12],[6,4],[1.5000000001,1],[7,4]]) {
    assert.equal(applyRatioId({numerator,denominator}), null);
    assert.equal((await proposeRelationshipApply({numerator,denominator},base)).status,'unsupported');
  }
  const forward=await adaptHarmonicConfig(base); if(forward.status!=='supported') throw new Error('fixture');
  const cascade={...base,ratioId:'cascade-13-12' as const};
  assert.equal((await inverseHarmonicConfig(forward.constellation,cascade)).status,'unsupported');
  assert.equal((await proposeRelationshipApply({numerator:3,denominator:2},cascade)).status,'unsupported');
  for(const context of [undefined,null,{}, {...base,uiVolume:undefined},{...base,baseHz:NaN}]) assert.equal((await inverseHarmonicConfig(forward.constellation,context)).status,'invalid');
  for(const value of [null,{}, {...forward.constellation,signature:'bad'}, {...forward.constellation,members:[]}, {...forward.constellation,members:forward.constellation.members.map(m=>({...m,frequencyHz:123}))}]) assert.equal((await inverseHarmonicConfig(value,base)).status,'invalid');
  assert.equal((await proposeRelationshipApply({numerator:1,denominator:0},base)).status,'invalid');
  assert.equal((await proposeRelationshipApply({numerator:3,denominator:2},{...base,baseHz:2000,ratioId:'root'})).status,'invalid');
});

test('inverse: snapshots both inputs before async validation, preserving explicit context instead of guessing from signature', async () => {
  const original={...base,progression:['root','fourth'] as RatioId[]}; const forward=await adaptHarmonicConfig(original); if(forward.status!=='supported') throw new Error('fixture');
  const context=structuredClone(original), constellation=structuredClone(forward.constellation) as unknown as { members: { frequencyHz: number }[] };
  const pending=inverseHarmonicConfig(constellation,context);
  context.uiVolume=99; context.progression.reverse(); constellation.members[0].frequencyHz=999;
  const result=await pending; assert.equal(result.status,'supported'); if(result.status==='supported') assert.deepEqual(result.config,original);
  const explicit={...original,durationSeconds:90,uiVolume:5};
  const other=await inverseHarmonicConfig(forward.constellation,explicit); assert.equal(other.status,'supported'); if(other.status==='supported') assert.deepEqual(other.config,explicit);
});

test('apply → ordinary Phase 1A confirmation snapshot → explicit save preserves the applied config without schema changes', async () => {
  let writes=0; const map=new Map<string,string>(); const store=new ExperimentStore({getItem:k=>map.get(k)??null,setItem:(k,v)=>{writes++;map.set(k,v);}},async task=>task());
  const selected=await proposeRelationshipApply({numerator:6,denominator:5},base); if(selected.status!=='supported') throw new Error('fixture');
  assert.equal(writes,0); assert.equal(store.load().length,0); // selection alone produces no record
  const applied=await inverseHarmonicConfig(selected.constellation,base); if(applied.status!=='supported') throw new Error('fixture');
  assert.equal(writes,0); assert.equal(store.load().length,0); // apply alone produces no record
  const draft=prepareExperiment(applied.config,{preState:{clarity:0}},'phase1d-test','2026-09-19T10:00:00.000Z');
  assert.deepEqual(draft.configurationSnapshot,applied.config); assert.equal(draft.configurationSnapshot.ratioId,'minor-third'); assert.equal(writes,0);
  const stopped=transitionExperiment(transitionExperiment(draft,'started','2026-09-19T10:00:01.000Z'),'cancelled','2026-09-19T10:00:05.000Z');
  await store.save(stopped); assert.equal(writes,1); assert.deepEqual([...map.keys()],[EXPERIMENTS_KEY]);
  assert.deepEqual(validateExperiment(JSON.parse(JSON.stringify(store.load()[0]))),stopped);
});

test('inverse: altered valid seed/mode and new voices cannot escape the supplied context', async () => {
  for(const patch of [{baseHz:440}, {mode:'simultaneous' as const}, {progression:['root','fifth','fourth'] as RatioId[]}]) {
    const candidate=await adaptHarmonicConfig({...base,...patch}); if(candidate.status!=='supported') throw new Error('fixture');
    assert.equal((await inverseHarmonicConfig(candidate.constellation,base)).status,'unsupported');
  }
});

test('apply: pure bridge never reads browser storage or constructs audio', async () => {
  const keys=['localStorage','sessionStorage','indexedDB','AudioContext','webkitAudioContext'];
  const saved=keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)] as const);
  try {
    for(const key of keys) Object.defineProperty(globalThis,key,{configurable:true,get(){throw new Error(`Forbidden: ${key}`);}});
    const result=await proposeRelationshipApply({numerator:5,denominator:4},base);
    assert.equal(result.status,'supported');
  } finally { for(const [key,descriptor] of saved) {if(descriptor) Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);} }
});
