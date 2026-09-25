import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adaptHarmonicConfig } from '../src/lib/harmonic/adapter';
import { buildSchedule, RATIOS, type HarmonicConfig, type RatioId } from '../src/lib/harmonic/math';

const base: HarmonicConfig = { baseHz: 432, ratioId: 'fifth', increments: 3, direction: 'ascending', mode: 'sequence', durationSeconds: 300, uiVolume: 20, waveform: 'sine' };
const intervals = Object.keys(RATIOS).filter(id => id !== 'cascade-13-12') as RatioId[];

test('adapter: all named intervals, modes and V1 boundary settings retain exact frequencies and schedule', async () => {
  for (const ratioId of intervals) for (const mode of ['sequence', 'simultaneous'] as const)
    for (const baseHz of [40, 40.000000001, 432, 432.123456789, 1999.999999, 2000])
      for (const direction of ['ascending', 'descending', 'return'] as const)
        for (const increments of [1, 8]) for (const durationSeconds of [1, 3600]) for (const uiVolume of [0, 100]) {
          const config = { ...base, ratioId, mode, baseHz, direction, increments, durationSeconds, uiVolume };
          let expected;
          try { expected = buildSchedule(config); } catch { assert.equal((await adaptHarmonicConfig(config)).status, 'invalid'); continue; }
          const result = await adaptHarmonicConfig(config);
          assert.equal(result.status, 'supported'); if (result.status !== 'supported') throw new Error('unsupported interval');
          assert.deepEqual(result.sourceConfig, config);
          assert.deepEqual(result.schedule, expected);
          assert.equal(result.constellation.seedFrequencyHz, baseHz);
          assert.equal(result.constellation.playbackMode, mode);
          assert.deepEqual(result.constellation.members.map(m => m.frequencyHz), expected.steps.flatMap(step => step.frequencies));
          assert.deepEqual(result.constellation.members.map(m => m.relationshipType === 'root' ? '1:1' : m.relationshipType === 'ratio' ? `${m.ratio.numerator}:${m.ratio.denominator}` : 'unexpected'), expected.steps.flatMap(step => step.ratios));
          assert.deepEqual(result.constellation.playbackOrder, mode === 'sequence' ? result.constellation.members.map(m => m.id) : null);
        }
});

test('adapter: explicit progression order, omitted seed and repeated voices are never reinterpreted', async () => {
  for (const mode of ['sequence', 'simultaneous'] as const) for (const progression of [
    ['fifth'], ['root', 'root'], ['fifth', 'minor-third', 'root', 'fifth'],
    ...intervals.flatMap(a => intervals.map(b => [a, b])), Array(9).fill('root'),
  ] as RatioId[][]) {
    const config = { ...base, mode, progression };
    const result = await adaptHarmonicConfig(config);
    assert.equal(result.status, 'supported'); if (result.status !== 'supported') throw new Error('unsupported progression');
    assert.deepEqual(result.schedule, buildSchedule(config));
    assert.deepEqual(result.sourceConfig.progression, progression);
    assert.equal(result.constellation.members.length, progression.length);
    assert.equal(new Set(result.constellation.members.map(m => m.id)).size, progression.length);
    assert.deepEqual(result.constellation.members.map(m => m.frequencyHz), buildSchedule(config).steps.flatMap(step => step.frequencies));
  }
});

test('adapter: deterministic snapshot cannot be changed by input mutation while SHA-256 runs', async () => {
  const config = { ...base, progression: ['fifth', 'root'] as RatioId[] };
  const original = structuredClone(config); const pending = adaptHarmonicConfig(config);
  config.baseHz = 220; config.progression.reverse();
  const result = await pending;
  assert.deepEqual(result, await adaptHarmonicConfig(original));
  assert.equal(result.status, 'supported'); if (result.status !== 'supported') return;
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.sourceConfig));
  assert.ok(Object.isFrozen(result.sourceConfig.progression)); assert.ok(Object.isFrozen(result.schedule));
  assert.ok(Object.isFrozen(result.schedule.steps)); assert.ok(Object.isFrozen(result.schedule.steps[0]));
  assert.ok(Object.isFrozen(result.schedule.steps[0].frequencies)); assert.ok(Object.isFrozen(result.schedule.steps[0].ratios));
});

test('adapter: constellation signature is not a playback fingerprint; timing and gain remain separate', async () => {
  const a = await adaptHarmonicConfig(base), b = await adaptHarmonicConfig({ ...base, durationSeconds: 60, uiVolume: 0 });
  assert.equal(a.status, 'supported'); assert.equal(b.status, 'supported');
  if (a.status !== 'supported' || b.status !== 'supported') return;
  assert.equal(a.constellation.signature, b.constellation.signature);
  assert.notDeepEqual(a.sourceConfig, b.sourceConfig); assert.notDeepEqual(a.schedule, b.schedule);
});

test('adapter: valid cascades explicitly unsupported in every mode/direction; never approximated', async () => {
  for (const mode of ['sequence', 'simultaneous'] as const) for (const direction of ['ascending', 'descending', 'return'] as const) {
    const result = await adaptHarmonicConfig({ ...base, ratioId: 'cascade-13-12', mode, direction });
    assert.equal(result.status, 'unsupported'); if (result.status === 'unsupported') assert.equal(result.code, 'cascade-not-supported');
    assert.ok(!('constellation' in result));
  }
});

test('adapter: invalid and unknown fields are rejected without coercion or partial conversion', async () => {
  for (const input of [null, [], 432, {}, ...[
    { baseHz: NaN }, { baseHz: '432' }, { baseHz: 39 }, { baseHz: 2001 }, { baseHz: 2000 },
    { ratioId: 'unknown' }, { mode: 'random' }, { waveform: 'square' }, { durationSeconds: 0 },
    { durationSeconds: Infinity }, { uiVolume: -1 }, { uiVolume: 101 }, { increments: 0 },
    { increments: 1.5 }, { direction: 'unknown' }, { progression: [] }, { progression: new Array(2) },
    { progression: ['cascade-13-12'] }, { progression: ['bad'] }, { progression: Array(10).fill('root') },
    { progression: null }, { unexpected: true },
  ].map(patch => ({ ...base, ...patch }))]) {
    const result = await adaptHarmonicConfig(input); assert.equal(result.status, 'invalid'); assert.ok(!('constellation' in result));
  }
});

test('adapter: no browser storage or audio capability is read or written', async () => {
  const keys = ['localStorage', 'sessionStorage', 'indexedDB', 'AudioContext', 'webkitAudioContext'] as const;
  const saved = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  try {
    for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, get() { throw new Error(`Unexpected capability: ${key}`); } });
    assert.equal((await adaptHarmonicConfig(base)).status, 'supported');
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
