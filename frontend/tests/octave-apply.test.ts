import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proposeOctaveApply } from '../src/lib/harmonic/octaveApply';
import { exploreHarmonics } from '../src/lib/harmonic/explorer';
import { buildSchedule, RATIOS, type HarmonicConfig } from '../src/lib/harmonic/math';
import { proposeRelationshipApply } from '../src/lib/harmonic/apply';
import { prepareExperiment } from '../src/lib/experiments/validation';
import { ExperimentStore, EXPERIMENTS_KEY } from '../src/lib/experiments/storage';
const base: HarmonicConfig = { baseHz: 432, ratioId: 'root', increments: 3, direction: 'ascending', mode: 'sequence', durationSeconds: 300, uiVolume: 20, waveform: 'sine' };

test('octave apply: every explorer offset is exact, including boundaries and fractional seeds', () => {
  for (const seed of [40, 40.0000000001, 80, 432, 432.123456789, 1000, 1999.999999999, 2000]) {
    for (const row of exploreHarmonics(seed).octaves) {
      const context = { ...base, baseHz: seed }; const before = structuredClone(context);
      const result = proposeOctaveApply(row.offset, context);
      assert.equal(result.status, 'supported'); if (result.status !== 'supported') throw new Error('Expected supported proposal');
      assert.equal(result.config.baseHz, seed * 2 ** row.offset);
      assert.deepEqual(result.config, { ...context, baseHz: row.frequencyHz });
      assert.deepEqual(context, before); assert.ok(Object.isFrozen(result.config));
    }
  }
  for (const [offset, hz] of [[-3,54],[-2,108],[-1,216],[0,432],[1,864],[2,1728]]) {
    const result = proposeOctaveApply(offset, base); assert.equal(result.status, 'supported');
    if (result.status === 'supported') assert.equal(result.config.baseHz, hz);
  }
});

test('octave apply: rejects invalid offsets, inputs, bounds and whole-session derived overflow without correcting', () => {
  for (const offset of [NaN, Infinity, 0.5, '1', null, 10000, -10000, -4, 3]) assert.equal(proposeOctaveApply(offset, base).status, 'invalid');
  for (const context of [null, {}, { ...base, surprise: 1 }, { ...base, progression: 'root' }, { ...base, baseHz: 39 }, { ...base, uiVolume: 101 }]) assert.equal(proposeOctaveApply(0, context).status, 'invalid');
  assert.equal(proposeOctaveApply(-1, { ...base, baseHz: 40 }).status, 'invalid');
  assert.equal(proposeOctaveApply(1, { ...base, baseHz: 2000 }).status, 'invalid');
  assert.equal(proposeOctaveApply(2, { ...base, ratioId: 'fifth' }).status, 'invalid'); // seed 1728 valid, derived 2592 invalid
  assert.equal(proposeOctaveApply(1, { ...base, baseHz: 800, ratioId: 'cascade-13-12', increments: 8 }).status, 'invalid');
});

test('octave apply: preserves every other field, progression and exact cascade semantics in both modes', () => {
  for (const mode of ['sequence','simultaneous'] as const) for (const direction of ['ascending','descending','return'] as const) {
    for (const patch of [{ ratioId: 'fifth' as const }, { progression: ['minor-third','root','fifth'] as HarmonicConfig['progression'] }, { ratioId: 'cascade-13-12' as const }]) {
      const context = { ...base, mode, direction, durationSeconds: 90, uiVolume: 7, ...patch };
      const result = proposeOctaveApply(1, context); assert.equal(result.status, 'supported'); if (result.status !== 'supported') throw new Error('Expected supported proposal');
      assert.deepEqual(result.config, { ...context, baseHz: 864 });
      assert.deepEqual(buildSchedule(result.config), buildSchedule({ ...context, baseHz: 864 }));
      if (context.progression) { context.progression.reverse(); assert.deepEqual(result.config.progression, ['minor-third','root','fifth']); assert.ok(Object.isFrozen(result.config.progression)); }
    }
  }
});

test('octave and Phase 1D ratio apply commute for all supported ratios and modes where both are valid', async () => {
  for (const id of ['root','fifth','fourth','major-third','minor-third'] as const) for (const mode of ['sequence','simultaneous'] as const) for (const offset of [-3,-1,0,1]) {
    const context = { ...base, mode }; const r = RATIOS[id]; const ratio = { numerator: r.p, denominator: r.q };
    const ratioFirst = await proposeRelationshipApply(ratio, context); if (ratioFirst.status !== 'supported') throw new Error(ratioFirst.reason);
    const a = proposeOctaveApply(offset, ratioFirst.config);
    const octaveFirst = proposeOctaveApply(offset, context); if (octaveFirst.status !== 'supported') throw new Error(octaveFirst.reason);
    const b = await proposeRelationshipApply(ratio, octaveFirst.config);
    assert.equal(a.status, 'supported'); assert.equal(b.status, 'supported');
    if (a.status === 'supported' && b.status === 'supported') { assert.deepEqual(a.config, b.config); assert.deepEqual(buildSchedule(a.config), buildSchedule(b.config)); }
  }
});

test('octave apply: no storage/audio effects; existing experiment snapshot and explicit save use only existing namespace', async () => {
  const keys = ['localStorage','sessionStorage','indexedDB','AudioContext','webkitAudioContext'];
  const saved = keys.map(key => [key,Object.getOwnPropertyDescriptor(globalThis,key)] as const);
  try {
    for (const key of keys) Object.defineProperty(globalThis,key,{configurable:true,get(){throw new Error(`Forbidden: ${key}`);}});
    let writes = 0; const map = new Map<string,string>();
    const store = new ExperimentStore({getItem:k=>map.get(k)??null,setItem:(k,v)=>{writes++;map.set(k,v);}},async task=>task());
    const result = proposeOctaveApply(1, { ...base, ratioId: 'fifth' }); if (result.status !== 'supported') throw new Error('Expected supported proposal');
    assert.equal(writes,0); assert.equal(store.load().length,0);
    const draft = prepareExperiment(result.config,{preState:{focus:0}},'phase1e-test','2026-09-19T12:00:00.000Z');
    assert.deepEqual(draft.configurationSnapshot,result.config); assert.equal(draft.configurationSnapshot.baseHz,864); assert.equal(draft.preState.energy,undefined); assert.equal(writes,0);
    await store.save(draft); assert.equal(writes,1); assert.deepEqual([...map.keys()],[EXPERIMENTS_KEY]);
  } finally { for (const [key,descriptor] of saved) { if(descriptor) Object.defineProperty(globalThis,key,descriptor); else Reflect.deleteProperty(globalThis,key); } }
});
