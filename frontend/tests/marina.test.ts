import assert from 'node:assert/strict';
import test from 'node:test';
import { MarinaAudio } from '../src/lib/marina/audio';
import { MARINA_PHASES, MARINA_TOTAL_MS, MARINA_STORAGE_KEY, MARINA_VERSION, MarinaClock, marinaPhaseAt, readMarinaRecords, saveMarinaRecord, validateMarinaAudio, type MarinaRecord } from '../src/lib/marina/model';

class Param {
  value = 0;
  events: { value: number; time: number }[] = [];
  setValueAtTime(value: number, time = 0) { this.value = value; this.events.push({ value, time }); }
  linearRampToValueAtTime(value: number) { this.value = value; }
  setTargetAtTime(value: number) { this.value = value; }
  cancelScheduledValues() {}
}
class Node {
  frequency = new Param(); gain = new Param(); type = 'sine';
  connections: { destination: unknown; output?: number; input?: number }[] = [];
  started = false; stopped = false; disconnected = false;
  starts: number[] = []; stops: number[] = [];
  connect(destination: unknown, output?: number, input?: number) { this.connections.push({ destination, output, input }); return destination; }
  start(at = 0) { this.started = true; this.starts.push(at); } stop(at = 0) { this.stopped = true; this.stops.push(at); } disconnect() { this.disconnected = true; }
}
class Context {
  currentTime = 0; sampleRate = 48000; state = 'running'; destination = {}; onstatechange: (() => void) | null = null;
  oscillators: Node[] = []; gains: Node[] = []; mergers: Node[] = [];
  resume = async () => { this.state = 'running'; };
  close = async () => { this.state = 'closed'; };
  createOscillator() { const n = new Node(); this.oscillators.push(n); return n; }
  createGain() { const n = new Node(); this.gains.push(n); return n; }
  createChannelMerger() { const n = new Node(); this.mergers.push(n); return n; }
  asAudio() { return this as unknown as AudioContext; }
}
const record = (): MarinaRecord => ({ id: 'session-one', version: MARINA_VERSION, startedAt: '2026-11-20T22:00:00Z', endedAt: '2026-11-20T22:24:00Z', kind: 'guided', status: 'completed', elapsedMs: MARINA_TOTAL_MS, config: { mode: 'pulse', hz: 3, carrierHz: 200 }, soundEnabled: true, notes: { intention: 'Explorar', experience: '', interpretation: '', events: '', action: '' } });
function storage(initial?: string) { const values = new Map<string, string>(); if (initial !== undefined) values.set(MARINA_STORAGE_KEY, initial); return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } }; }

test('guided clock visits each phase exactly and ends at 24 minutes', () => {
  assert.equal(MARINA_TOTAL_MS, 24 * 60000);
  let boundary = 0;
  for (const phase of MARINA_PHASES) {
    assert.equal(marinaPhaseAt(boundary)?.id, phase.id);
    assert.equal(marinaPhaseAt(boundary + phase.seconds * 1000 - 1)?.id, phase.id);
    boundary += phase.seconds * 1000;
  }
  assert.equal(marinaPhaseAt(boundary), null);
});
test('active clock excludes pause time and caps at completion', () => {
  const c = new MarinaClock(10000); c.resume(100); c.pause(1100);
  assert.equal(c.tick(5000), 1000); c.resume(9000);
  assert.equal(c.tick(10000), 2000); assert.equal(c.tick(999999), 10000);
});
test('all guided phase boundaries and final silence are scheduled without UI timer callbacks', async () => {
  const ctx = new Context(), audio = new MarinaAudio(() => ctx.asAudio());
  const steps = MARINA_PHASES.map(phase => ({ seconds: phase.seconds, config: { mode: phase.mode, hz: phase.hz, carrierHz: 200 } }));
  await audio.playTimeline(steps, .15);
  assert.deepEqual(ctx.oscillators.map(node => node.starts[0]), [0, 0, 240, 240, 420, 420, 900, 900, 1140, 1140]);
  assert.deepEqual(ctx.oscillators.map(node => node.stops[0]), [240.01, 240.01, 420.01, 420.01, 900.01, 900.01, 1140.01, 1140.01, 1260.01, 1260.01]);
  assert.deepEqual(ctx.gains[0].gain.events.at(-1), { value: 0, time: 1440 });
  ctx.currentTime = 5; audio.stop();
  assert.ok(ctx.oscillators.every(node => node.stops.at(-1) === 5.035), 'stop cancels future phases as well as the current one');
  audio.dispose();
});
test('resume schedules only the remaining phases and silence never creates an audio context', async () => {
  const ctx = new Context(), audio = new MarinaAudio(() => ctx.asAudio());
  const steps = MARINA_PHASES.map(phase => ({ seconds: phase.seconds, config: { mode: phase.mode, hz: phase.hz, carrierHz: 200 } }));
  await audio.playTimeline(steps, .15, 450000);
  assert.deepEqual(ctx.oscillators.map(node => node.frequency.value), [200, 207, 200, 207, 200, 8]);
  assert.deepEqual(ctx.oscillators.map(node => node.starts[0]), [0, 0, 450, 450, 690, 690]);
  audio.dispose();
  const silent = new MarinaAudio(() => { throw new Error('must not create'); });
  assert.equal(await silent.playTimeline(steps, .15, 1260000), true);
  await assert.rejects(silent.playTimeline(steps, .15, 1440000));
});
test('stop during a timeline unlock prevents every future phase from starting', async () => {
  const ctx = new Context(); ctx.state = 'suspended'; let resolve!: () => void;
  ctx.resume = () => new Promise<void>(r => { resolve = () => { ctx.state = 'running'; r(); }; });
  const audio = new MarinaAudio(() => ctx.asAudio());
  const pending = audio.playTimeline([{ config: { mode: 'direct', hz: 200, carrierHz: 200 }, seconds: 60 }], .15);
  audio.stop(); resolve();
  assert.equal(await pending, false); assert.equal(ctx.oscillators.length, 0); audio.dispose();
});
test('binaural graph routes 200 and 207 into separate channels', async () => {
  const ctx = new Context(); let externalStops = 0;
  const audio = new MarinaAudio(() => ctx.asAudio(), () => { externalStops++; });
  assert.equal(await audio.play({ mode: 'binaural', carrierHz: 200, hz: 7 }, .15), true);
  assert.deepEqual(ctx.oscillators.map(n => n.frequency.value), [200, 207]);
  assert.deepEqual(ctx.oscillators.map(n => n.connections[0].input), [0, 1]);
  assert.equal(externalStops, 1); audio.dispose();
});
test('pulse graph uses audible carrier, DC offset and bounded sinusoidal depth', async () => {
  const ctx = new Context(), audio = new MarinaAudio(() => ctx.asAudio());
  await audio.play({ mode: 'pulse', carrierHz: 200, hz: 3 }, .15);
  assert.deepEqual(ctx.oscillators.map(n => n.frequency.value), [200, 3]);
  assert.equal(ctx.gains[1].gain.value, .5); assert.equal(ctx.gains[2].gain.value, .5);
  assert.equal(ctx.gains[2].connections[0].destination, ctx.gains[1].gain);
  audio.dispose();
});
test('stop during audio unlock prevents a late graph from playing', async () => {
  const ctx = new Context(); ctx.state = 'suspended'; let resolve!: () => void;
  ctx.resume = () => new Promise<void>(r => { resolve = () => { ctx.state = 'running'; r(); }; });
  const audio = new MarinaAudio(() => ctx.asAudio());
  const pending = audio.play({ mode: 'direct', hz: 28, carrierHz: 200 }, .15);
  audio.stop(); resolve(); assert.equal(await pending, false); assert.equal(ctx.oscillators.length, 0); audio.dispose();
});
test('changing recipe stops every old source; volume zero remains valid', async () => {
  const ctx = new Context(), audio = new MarinaAudio(() => ctx.asAudio());
  await audio.play({ mode: 'pulse', hz: 3, carrierHz: 200 }, .15);
  const old = [...ctx.oscillators]; await audio.play({ mode: 'direct', hz: 28, carrierHz: 200 }, .15);
  assert.ok(old.every(n => n.stopped)); audio.setVolume(0); assert.equal(ctx.gains.at(-1)?.gain.value, 0); audio.dispose();
});
test('device audio interruption notifies session owner', async () => {
  const ctx = new Context(); let interruptions = 0;
  const audio = new MarinaAudio(() => ctx.asAudio(), () => {}, () => { interruptions++; });
  await audio.play({ mode: 'direct', hz: 28, carrierHz: 200 }, .15);
  ctx.state = 'suspended'; ctx.onstatechange?.(); assert.equal(interruptions, 1);
  assert.ok(ctx.oscillators.every(n => n.stopped)); audio.dispose();
});
test('silence never creates an AudioContext and ultrasonic reference is not playable', async () => {
  const audio = new MarinaAudio(() => { throw new Error('must not create'); });
  assert.equal(await audio.play({ mode: 'silence', hz: 0, carrierHz: 200 }, 0), true);
  assert.throws(() => validateMarinaAudio({ mode: 'direct', hz: 378394, carrierHz: 200 }));
  assert.throws(() => validateMarinaAudio({ mode: 'binaural', hz: NaN, carrierHz: 200 }));
  assert.throws(() => validateMarinaAudio({ mode: 'pulse', hz: 3, carrierHz: 1 }));
});
test('journal upserts by session id and preserves blank experiences', () => {
  const s = storage(), r = record(); saveMarinaRecord(s, r);
  saveMarinaRecord(s, { ...r, notes: { ...r.notes, events: 'Una idea posterior' } });
  const rows = readMarinaRecords(s); assert.equal(rows.length, 1); assert.equal(rows[0].notes.experience, ''); assert.equal(rows[0].notes.events, 'Una idea posterior');
});
test('corrupt or malformed diary is never overwritten', () => {
  for (const raw of ['broken-json', '[{"id":"incomplete"}]']) {
    const s = storage(raw); assert.throws(() => saveMarinaRecord(s, record())); assert.equal(s.getItem(MARINA_STORAGE_KEY), raw);
  }
});

test('12-minute creation visits all five phases and ends in silence without changing classic timing', async () => {
  const { marinaDuration, marinaPhases } = await import('../src/lib/marina/model');
  assert.equal(marinaDuration('creation12'), 720000);
  assert.equal(marinaDuration('classic24'), 1440000);
  let boundary = 0;
  for (const phase of marinaPhases('creation12')) {
    assert.equal(marinaPhaseAt(boundary, 'creation12')?.id, phase.id);
    assert.equal(marinaPhaseAt(boundary + phase.seconds * 1000 - 1, 'creation12')?.id, phase.id);
    boundary += phase.seconds * 1000;
  }
  assert.equal(marinaPhaseAt(boundary, 'creation12'), null);
  assert.equal(marinaPhaseAt(600000, 'creation12')?.mode, 'silence');
});
test('new session metadata and dated follow-ups round-trip without migrating old records', async () => {
  const { addMarinaFollowUp } = await import('../src/lib/marina/model');
  const s = storage(), old = record(); saveMarinaRecord(s, old);
  const next: MarinaRecord = { ...record(), id: 'new', protocol: 'creation12', practice: { statement: 'Mi frase', scene: 'Escena', feeling: 'Calma' } };
  saveMarinaRecord(s, next);
  addMarinaFollowUp(s, 'new', { id: 'first', at: '2026-11-21T12:00:00Z', text: 'Primer hecho' });
  addMarinaFollowUp(s, 'new', { id: 'second', at: '2026-11-22T12:00:00Z', text: 'Segundo hecho' });
  const rows = readMarinaRecords(s);
  assert.deepEqual(rows[0], old);
  assert.deepEqual(rows[1].practice, next.practice);
  assert.deepEqual(rows[1].followUps?.map(f => f.text), ['Primer hecho', 'Segundo hecho']);
  assert.throws(() => addMarinaFollowUp(s, 'missing', { id: 'x', at: new Date().toISOString(), text: 'Lost' }));
  assert.throws(() => addMarinaFollowUp(s, 'new', { id: 'x', at: new Date().toISOString(), text: ' ' }));
});
test('malformed new metadata preserves the original diary', () => {
  for (const field of [{ protocol: 'unknown' }, { practice: { statement: 1 } }, { followUps: [{ id: 'x', at: 'invalid', text: 'x' }] }]) {
    const raw = JSON.stringify([{ ...record(), ...field }]), s = storage(raw);
    assert.throws(() => saveMarinaRecord(s, record())); assert.equal(s.getItem(MARINA_STORAGE_KEY), raw);
  }
});
