import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COMPOSER_RECIPES_KEY, COMPOSER_SESSIONS_KEY, NANO_REFERENCES, compositionMix,
  defaultComposition, starterCompositions, readCompositions, readComposerSessions, saveComposition, saveComposerSession,
  validateComposition, type ComposerSession,
} from '../src/lib/marina/composer';
import { MarinaComposerAudio } from '../src/lib/marina/composerAudio';

class Param {
  value = 0;
  events: { method: string; value?: number; time: number }[] = [];
  setValueAtTime(value: number, time: number) { this.value = value; this.events.push({ method: 'set', value, time }); }
  linearRampToValueAtTime(value: number, time: number) { this.value = value; this.events.push({ method: 'ramp', value, time }); }
  cancelAndHoldAtTime(time: number) { this.events.push({ method: 'hold', time }); }
}
class Node {
  frequency = new Param(); gain = new Param(); type = '';
  connections: { destination: unknown; output?: number; input?: number }[] = [];
  starts: number[] = []; stops: number[] = []; disconnected = false;
  connect(destination: unknown, output?: number, input?: number) { this.connections.push({ destination, output, input }); return destination; }
  start(at: number) { this.starts.push(at); } stop(at: number) { this.stops.push(at); } disconnect() { this.disconnected = true; }
}
class Context {
  currentTime = 10; sampleRate = 48000; state = 'running'; destination = {};
  onstatechange: (() => void) | null = null;
  oscillators: Node[] = []; gains: Node[] = []; mergers: Node[] = [];
  resume = async () => { this.state = 'running'; };
  close = async () => { this.state = 'closed'; };
  createOscillator() { const node = new Node(); this.oscillators.push(node); return node; }
  createGain() { const node = new Node(); this.gains.push(node); return node; }
  createChannelMerger() { const node = new Node(); this.mergers.push(node); return node; }
  audio() { return this as unknown as AudioContext; }
}
function store(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

test('starter recipes survive fresh devices and local edits without writing over saved recipes or journals', () => {
  const desktop = store({ 'fh.marina.sessions.v1': 'private desktop journal' });
  const phone = store();
  const recipes = starterCompositions();
  recipes.forEach(recipe => validateComposition(recipe));
  const copy = structuredClone(recipes[0]);
  copy.name = 'Mi copia'; copy.layers[0].rateHz = 6;
  saveComposition(desktop, { id: 'personal', savedAt: '2026-11-22T15:00:00Z', recipe: copy });
  assert.equal(readCompositions(desktop)[0].recipe.layers[0].rateHz, 6);
  assert.equal(desktop.getItem('fh.marina.sessions.v1'), 'private desktop journal');
  assert.deepEqual(readCompositions(phone), []);
  assert.deepEqual(starterCompositions(), recipes);
  recipes[0].layers[0].rateHz = 12;
  assert.equal(starterCompositions()[0].layers[0].rateHz, 7.8);
});

test('composer preserves every sub-Hz decimal through save/load, without changing the older Marina journal', () => {
  const storage = store({ 'fh.marina.sessions.v1': 'legacy untouched' });
  for (const reference of NANO_REFERENCES) {
    const recipe = defaultComposition(); recipe.layers[0].rateHz = reference.hz;
    saveComposition(storage, { id: String(reference.hz), savedAt: '2026-11-22T12:00:00Z', recipe });
  }
  assert.deepEqual(readCompositions(storage).map(row => row.recipe.layers[0].rateHz), [7.5, .3879, .32789, .378394]);
  assert.equal(storage.getItem('fh.marina.sessions.v1'), 'legacy untouched');
});
test('invalid and corrupt recipes are preserved rather than overwritten', () => {
  for (const raw of ['broken', 'null', '[null]', JSON.stringify([{ recipe: { ...defaultComposition(), layers: [] } }])]) {
    const storage = store({ [COMPOSER_RECIPES_KEY]: raw });
    assert.throws(() => saveComposition(storage, { id: 'next', savedAt: '2026-11-22T12:00:00Z', recipe: defaultComposition() }));
    assert.equal(storage.getItem(COMPOSER_RECIPES_KEY), raw);
  }
});
test('validation rejects NaN, duplicate layers, impossible sidebands and out-of-range depth', () => {
  for (const change of [
    (r: ReturnType<typeof defaultComposition>) => { r.layers[0].rateHz = NaN; },
    (r: ReturnType<typeof defaultComposition>) => { r.layers[1].id = r.layers[0].id; },
    (r: ReturnType<typeof defaultComposition>) => { r.layers[0].carrierHz = 23999; r.layers[0].rateHz = 7; },
    (r: ReturnType<typeof defaultComposition>) => { r.layers[0].depth = 1.1; },
    (r: ReturnType<typeof defaultComposition>) => { r.durationMinutes = 0; },
    (r: ReturnType<typeof defaultComposition>) => { r.transitionSeconds = Infinity; },
  ]) { const recipe = defaultComposition(); change(recipe); assert.throws(() => validateComposition(recipe)); }
});
test('coherent mix is peak bounded without raising quiet layers to full gain', () => {
  const recipe = defaultComposition();
  recipe.layers.forEach(layer => { layer.enabled = true; layer.level = 1; });
  assert.equal(compositionMix(recipe).reduce((sum, layer) => sum + layer.gain, 0), 1);
  recipe.layers.forEach(layer => { layer.level = .1; });
  assert.ok(Math.abs(compositionMix(recipe).reduce((sum, layer) => sum + layer.gain, 0) - .3) < 1e-10);
});
test('real graph routes all three layer kinds correctly and never connects a sub-Hz LFO to the speakers', async () => {
  const ctx = new Context(), audio = new MarinaComposerAudio(() => ctx.audio());
  const recipe = defaultComposition(); recipe.layers.forEach(layer => { layer.enabled = true; });
  recipe.layers[0].rateHz = .32789;
  await audio.play(recipe, .15);
  assert.deepEqual(ctx.oscillators.map(node => node.frequency.value), [.32789, 200, 300, 220, 227]);
  const lfo = ctx.oscillators[0], envelope = ctx.gains[2], depth = ctx.gains[3];
  assert.equal(envelope.gain.value, .825); assert.equal(depth.gain.value, .175);
  assert.equal(lfo.connections[0].destination, depth);
  assert.equal(depth.connections[0].destination, envelope.gain);
  assert.ok(!lfo.connections.some(connection => connection.destination === ctx.destination));
  assert.deepEqual(ctx.oscillators.slice(-2).map(node => node.connections[0].input), [0, 1]);
  assert.ok(ctx.oscillators.every(node => node.starts[0] === 10 && node.stops[0] === 730.01));
  audio.dispose();
});
test('fade and oscillator stop are scheduled in audio time, even if UI timers never run', async () => {
  const ctx = new Context(), audio = new MarinaComposerAudio(() => ctx.audio());
  await audio.play(defaultComposition(), .15);
  assert.deepEqual(ctx.gains[0].gain.events.slice(0, 4), [
    { method: 'set', value: 0, time: 10 }, { method: 'ramp', value: .15, time: 12 },
    { method: 'set', value: .15, time: 728 }, { method: 'ramp', value: 0, time: 730 },
  ]);
  ctx.currentTime = 15; assert.equal(audio.elapsedMs(), 5000);
  audio.stop(); ctx.currentTime = 100; assert.equal(audio.elapsedMs(), 5000);
  await audio.play(defaultComposition(), .15, 5000);
  ctx.currentTime = 815; assert.equal(audio.elapsedMs(), 720000);
  audio.dispose();
});
test('volume zero, early stop and device interruption preserve mute and invalidate the graph', async () => {
  const ctx = new Context(); let interruptions = 0;
  const audio = new MarinaComposerAudio(() => ctx.audio(), () => {}, () => { interruptions++; });
  await audio.play(defaultComposition(), .15);
  ctx.currentTime = 14; audio.setVolume(0);
  assert.equal(ctx.gains[0].gain.events.at(-2)?.value, 0);
  ctx.state = 'suspended'; ctx.onstatechange?.();
  assert.equal(interruptions, 1); assert.ok(ctx.oscillators.every(node => node.stops.at(-1) === 14.035));
  audio.dispose();
});
test('cancel during unlock cannot start a late composition; all-muted recipes never allocate audio', async () => {
  const ctx = new Context(); ctx.state = 'suspended'; let unlock!: () => void;
  ctx.resume = () => new Promise<void>(resolve => { unlock = () => { ctx.state = 'running'; resolve(); }; });
  const audio = new MarinaComposerAudio(() => ctx.audio());
  const pending = audio.play(defaultComposition(), .15); audio.stop(); unlock();
  assert.equal(await pending, false); assert.equal(ctx.oscillators.length, 0); audio.dispose();
  const quiet = defaultComposition(); quiet.layers.forEach(layer => { layer.enabled = false; });
  const never = new MarinaComposerAudio(() => { throw new Error('should not allocate'); });
  await assert.rejects(never.play(quiet, .15), /Activa al menos/);
});
test('session snapshot round-trips and cannot replace a corrupt history', () => {
  const storage = store();
  const row: ComposerSession = { id: 'one', startedAt: '2026-11-22T12:00:00Z', endedAt: '2026-11-22T12:01:00Z', elapsedMs: 60000, status: 'stopped', recipe: defaultComposition(), experience: 'Una observación' };
  saveComposerSession(storage, row); saveComposerSession(storage, { ...row, experience: 'Actualizada' });
  assert.equal(readComposerSessions(storage).length, 1);
  assert.deepEqual(readComposerSessions(storage)[0].recipe, row.recipe);
  const corrupt = store({ [COMPOSER_SESSIONS_KEY]: '[null]' });
  assert.throws(() => saveComposerSession(corrupt, row)); assert.equal(corrupt.getItem(COMPOSER_SESSIONS_KEY), '[null]');
});

test('a failed new unlock cannot inherit elapsed time from the preceding session', async () => {
  const ctx = new Context(), audio = new MarinaComposerAudio(() => ctx.audio());
  await audio.play(defaultComposition(), .15);
  ctx.currentTime = 20; audio.stop(); assert.equal(audio.elapsedMs(), 10000);
  ctx.state = 'suspended'; ctx.resume = async () => { throw new Error('unlock denied'); };
  await assert.rejects(audio.play(defaultComposition(), .15), /unlock denied/);
  assert.equal(audio.elapsedMs(), 0); audio.dispose();
});

test('15-second preview retains exact recipe and frequencies, caps native duration and rejects invalid limits', async () => {
 const recipe=starterCompositions()[2], original=JSON.stringify(recipe), ctx=new Context();
 const engine=new MarinaComposerAudio(()=>ctx.audio());
 assert.equal(await engine.play(recipe,.15,0,15),true);
 assert.equal(JSON.stringify(recipe),original);
 assert.deepEqual(ctx.oscillators.map(o=>o.frequency.value),[220,235]);
 assert.ok(ctx.oscillators.every(o=>o.stops[0]===25.01));
 ctx.currentTime=25;assert.equal(engine.elapsedMs(),15000);engine.stop();
 await assert.rejects(()=>engine.play(recipe,.15,0,16),/muestra/);
 await assert.rejects(()=>engine.play(recipe,.15,0,NaN),/muestra/);
});
