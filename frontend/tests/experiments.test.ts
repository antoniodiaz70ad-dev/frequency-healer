import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareExperiment, transitionExperiment, validateExperiment } from '../src/lib/experiments/validation';
import { ExperimentStore, EXPERIMENTS_KEY, type ExperimentStorage, type ExperimentLock } from '../src/lib/experiments/storage';
import type { ExperimentRecordV1 } from '../src/lib/experiments/types';
import { buildSchedule, type HarmonicConfig } from '../src/lib/harmonic/math';
import { HarmonicEngine } from '../src/lib/harmonic/engine';
import { VoiceStore, SESSIONS_KEY } from '../src/lib/voice/storage';
import { buildProposal } from '../src/lib/voice/rules';
import { parseLocalIntent } from '../src/lib/voice/intentParser';
import { loadSessionLogs } from '../src/lib/sessionLog';

const selected: HarmonicConfig = { baseHz: 220, ratioId: 'fifth', increments: 3, direction: 'ascending', mode: 'sequence', durationSeconds: 300, uiVolume: 20, waveform: 'sine' };
const created = '2026-09-19T10:00:00.000Z', started = '2026-09-19T10:00:01.000Z', ended = '2026-09-19T10:05:01.000Z';
const lock: ExperimentLock = async operation => operation();
class Memory implements ExperimentStorage {
  map = new Map<string, string>(); writes = 0;
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) { this.writes++; this.map.set(key, value); }
}
function fixture(id = 'experiment-one') {
  return prepareExperiment(selected, { preState: { clarity: 0, energy: 7 }, expectationScore: 0 }, id, created);
}

test('experiment: exact detached frozen snapshot; missing ratings remain missing and zero survives', () => {
  const config = { ...selected, baseHz: 220.123456789, progression: ['root', 'fifth'] as HarmonicConfig['progression'] };
  const preState = { clarity: 0, mood: 6 };
  const record = prepareExperiment(config, { preState, expectationScore: 0 }, 'snapshot', created);
  const schedule = buildSchedule(config);
  config.baseHz = 440; config.progression![0] = 'fourth'; preState.mood = 1;
  assert.equal(record.configurationSnapshot.baseHz, 220.123456789);
  assert.deepEqual(buildSchedule({ ...record.configurationSnapshot, progression: [...record.configurationSnapshot.progression!] }), schedule);
  assert.deepEqual(record.preState, { clarity: 0, mood: 6 }); assert.deepEqual(record.postState, {});
  assert.equal(record.expectationScore, 0); assert.equal('tension' in record.preState, false);
  assert.ok(Object.isFrozen(record.configurationSnapshot)); assert.ok(Object.isFrozen(record.configurationSnapshot.progression));
  assert.throws(() => { (record.configurationSnapshot as HarmonicConfig).baseHz = 999; });
  assert.deepEqual(validateExperiment(JSON.parse(JSON.stringify(record))), record);
});

test('experiment: strict runtime contract rejects malformed versions, nested values and impossible lifecycle', () => {
  for (const patch of [
    { schemaVersion: 2 }, { source: 'voice' }, { status: 'stopped' }, { id: '' }, { createdAt: 'yesterday' },
    { preState: { clarity: null } }, { postState: { focus: '5' } }, { preState: { mood: 11 } },
    { preState: { energy: -1 } }, { preState: { tension: NaN } }, { expectationScore: Infinity },
    { expectationScore: -1 }, { expectationScore: 11 }, { preState: { invented: 3 } },
    { intention: 'a'.repeat(501) }, { context: 'a'.repeat(1001) }, { reflection: 'a'.repeat(2001) },
    { audio: 'not allowed' }, { completedAt: ended }, { status: 'started' }, { status: 'completed' },
    { configurationSnapshot: { ...selected, baseHz: 0 } },
    { configurationSnapshot: { ...selected, ratioId: 'octave' } },
    { configurationSnapshot: { ...selected, durationSeconds: 0 } },
    { configurationSnapshot: { ...selected, hiddenFrequency: 432 } },
  ]) assert.throws(() => validateExperiment({ ...fixture(), ...patch }), JSON.stringify(patch));
  const running = transitionExperiment(fixture(), 'started', started);
  assert.throws(() => validateExperiment({ ...running, startedAt: '2026-09-18T00:00:00.000Z' }));
  assert.throws(() => validateExperiment({ ...running, status: 'cancelled', endedAt: ended, completedAt: ended }));
  assert.throws(() => transitionExperiment(fixture(), 'completed', ended));
});

test('experiment: completion, manual stop and lifecycle interruption remain distinct; late completion cannot relabel a terminal record', () => {
  const prepared = fixture();
  assert.equal(transitionExperiment(prepared, 'cancelled', ended).status, 'prepared');
  assert.equal(transitionExperiment(prepared, 'interrupted', ended).status, 'prepared');
  const running = transitionExperiment(prepared, 'started', started);
  assert.equal(running.startedAt, started); assert.equal(running.completedAt, undefined);
  for (const status of ['completed', 'cancelled', 'interrupted'] as const) {
    const record = transitionExperiment(running, status, ended);
    assert.equal(record.status, status); assert.equal(record.endedAt, ended);
    assert.equal(record.completedAt, status === 'completed' ? ended : undefined);
    assert.strictEqual(transitionExperiment(record, 'completed', ended), record);
    assert.deepEqual(record.configurationSnapshot, prepared.configurationSnapshot);
  }
});

test('experiment storage: explicit save only, reload/export roundtrip and append-only snapshot identity', async () => {
  const memory = new Memory(), store = new ExperimentStore(memory, lock), draft = fixture();
  assert.deepEqual(store.load(), []); assert.equal(memory.writes, 0);
  const record = transitionExperiment(transitionExperiment(draft, 'started', started), 'completed', ended);
  await store.save(record); assert.deepEqual(store.load(), [record]);
  assert.deepEqual(JSON.parse(store.exportJSON()), [record]);
  await store.save(record); assert.equal(memory.writes, 1);
  await assert.rejects(store.save({ ...record, configurationSnapshot: { ...selected, baseHz: 440 } }), /identificador/);
  assert.deepEqual(store.load(), [record]);
});

test('experiment storage: corrupt/unknown payloads are preserved byte-for-byte, including foreign fields', async () => {
  for (const raw of ['{bad', 'null', '{}', JSON.stringify([{ ...fixture(), schemaVersion: 99 }]), JSON.stringify([fixture(), fixture()]), JSON.stringify([{ ...fixture(), audio: 'opaque' }])]) {
    const memory = new Memory(); memory.map.set(EXPERIMENTS_KEY, raw); const store = new ExperimentStore(memory, lock);
    assert.throws(() => store.load(), /inválido/); await assert.rejects(store.save(fixture('new')), /inválido/);
    assert.equal(memory.getItem(EXPERIMENTS_KEY), raw); assert.equal(memory.writes, 0);
  }
});

test('experiment storage: quota, denied access and unavailable locks never pretend a save succeeded', async () => {
  const quota = new ExperimentStore({ getItem: () => null, setItem: () => { throw new Error('quota'); } }, lock);
  await assert.rejects(quota.save(fixture()), /quota/);
  const denied = new ExperimentStore({ getItem: () => { throw new Error('denied'); }, setItem: () => assert.fail('must not write') }, lock);
  assert.throws(() => denied.load(), /denied/); await assert.rejects(denied.save(fixture()), /denied/);
  const unavailable: ExperimentLock = async () => { throw new Error('locks unavailable'); };
  const memory = new Memory(); await assert.rejects(new ExperimentStore(memory, unavailable).save(fixture()), /locks unavailable/);
  assert.equal(memory.writes, 0);
});

test('experiment storage: concurrent saves preserve both records and racing payload changes are rejected', async () => {
  let queue = Promise.resolve();
  const serialized: ExperimentLock = operation => { const result = queue.then(operation); queue = result.then(() => {}, () => {}); return result; };
  const memory = new Memory();
  await Promise.all([new ExperimentStore(memory, serialized).save(fixture('a')), new ExperimentStore(memory, serialized).save(fixture('b'))]);
  assert.equal(new ExperimentStore(memory, lock).load().length, 2);
  let reads = 0;
  const racing = new ExperimentStore({ getItem: () => ++reads === 1 ? null : '[]', setItem: () => assert.fail('must not overwrite') }, lock);
  await assert.rejects(racing.save(fixture()), /pestaña/);
});

test('experiment storage: actual legacy voice and OBE loaders return unchanged records and every legacy key is untouched', async () => {
  const memory = new Memory(), proposal = buildProposal(parseLocalIntent('focus 10 minutes'));
  const voice = { schemaVersion: 1, id: 'voice', createdAt: created, status: 'stopped', intent: proposal.intent, proposal, markers: [], technical: { actualDurationMs: 1000 } };
  const obe = { id: 'obe', createdAt: 1789812000000, sessionDate: '2026-09-19', focusLabel: 'Focus 10', durationMinutes: 10, paralysisAchieved: false, vibrations: true, separation: false, visualClarity: 'none', lookedBack: false, preEnergy: 5, postEnergy: 6, notes: 'Preserve this', tags: ['test'] };
  memory.map.set(SESSIONS_KEY, JSON.stringify([voice])); memory.map.set('fh:obe-session-logs-v1', JSON.stringify([obe]));
  for (const key of ['fh:next-session-config-v1', 'fh:hemi-sync-disclaimer-accepted-v1', 'fh:voice-consent-v1', 'fh:voice-settings-v1']) memory.map.set(key, ' { "untouched": true } ');
  const before = new Map(memory.map), windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: memory } });
  try {
    assert.deepEqual(new VoiceStore(memory, lock).load(), [voice]); assert.deepEqual(loadSessionLogs(), [obe]);
    await new ExperimentStore(memory, lock).save(fixture());
    assert.deepEqual(new VoiceStore(memory, lock).load(), [voice]); assert.deepEqual(loadSessionLogs(), [obe]);
    for (const [key, raw] of before) assert.equal(memory.getItem(key), raw);
  } finally { if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor); else Reflect.deleteProperty(globalThis, 'window'); }
});

// A controllable AudioContext exercises the real, unchanged HarmonicEngine.
class Param { value = 0; setValueAtTime(v: number) { this.value = v; } linearRampToValueAtTime(v: number) { this.value = v; } cancelAndHoldAtTime() {} }
class AudioNodeMock { disconnected = false; connect() {} disconnect() { this.disconnected = true; } }
class OscillatorMock extends AudioNodeMock {
  type = ''; frequency = new Param(); onended: (() => void) | null = null; starts: number[] = []; stops: number[] = [];
  start(time: number) { this.starts.push(time); } stop(time: number) { this.stops.push(time); }
}
class ContextMock {
  currentTime = 0; state = 'running'; destination = new AudioNodeMock(); oscs: OscillatorMock[] = [];
  resume = async () => {}; close = async () => { this.state = 'closed'; };
  createGain() { return Object.assign(new AudioNodeMock(), { gain: new Param() }); }
  createOscillator() { const osc = new OscillatorMock(); this.oscs.push(osc); return osc; }
}
test('experiment/audio: logging does not alter programmed tones/times; stop closes all nodes and pending duck timer', async () => {
  const plainContext = new ContextMock(), loggedContext = new ContextMock();
  const plain = new HarmonicEngine(() => plainContext as unknown as AudioContext);
  const logged = new HarmonicEngine(() => loggedContext as unknown as AudioContext);
  let record: ExperimentRecordV1 = fixture();
  await plain.start(selected);
  await logged.start(selected, () => { record = transitionExperiment(record, 'completed', ended); });
  record = transitionExperiment(record, 'started', started);
  const graph = (ctx: ContextMock) => ctx.oscs.map(o => ({ frequency: o.frequency.value, starts: o.starts, stops: o.stops, type: o.type }));
  assert.deepEqual(graph(loggedContext), graph(plainContext));
  const lateCompletion = loggedContext.oscs.at(-1)!.onended!;
  const pendingDuck = logged.duck(); record = transitionExperiment(record, 'interrupted', ended); logged.stop();
  for (const osc of loggedContext.oscs) osc.onended?.();
  assert.equal(await pendingDuck, false); assert.equal(logged.isPlaying(), false); assert.equal(loggedContext.state, 'closed');
  assert.ok(loggedContext.oscs.every(o => o.disconnected && o.stops.at(-1) === 0.03));
  lateCompletion(); assert.equal(record.status, 'interrupted'); assert.equal(record.completedAt, undefined);
  plain.stop(); for (const osc of plainContext.oscs) osc.onended?.();
});

test('experiment/audio: stop while resume is pending keeps the draft prepared and creates no late oscillators', async () => {
  const context = new ContextMock(); let resume!: () => void;
  context.state = 'suspended';
  context.resume = () => new Promise<void>(resolve => { resume = resolve; });
  const engine = new HarmonicEngine(() => context as unknown as AudioContext);
  let record = fixture();
  const pending = engine.start(selected, () => { record = transitionExperiment(record, 'completed', ended); });
  engine.dispose(); record = transitionExperiment(record, 'interrupted', ended); resume();
  assert.equal(await pending, false); assert.equal(record.status, 'prepared'); assert.equal(record.startedAt, undefined);
  assert.equal(context.oscs.length, 0); assert.equal(context.state, 'closed');
});

test('experiment/audio: only natural engine completion assigns completedAt', async () => {
  const context = new ContextMock(), engine = new HarmonicEngine(() => context as unknown as AudioContext);
  let record = fixture();
  await engine.start(selected, () => { record = transitionExperiment(record, 'completed', ended); });
  record = transitionExperiment(record, 'started', started);
  context.oscs[0].onended!(); assert.equal(record.status, 'started');
  context.oscs[1].onended!();
  assert.equal(record.status, 'completed'); assert.equal(record.completedAt, ended); assert.equal(context.state, 'closed');
});
