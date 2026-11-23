import assert from 'node:assert/strict';
import test from 'node:test';
import { CrystalAudio } from '../src/lib/crystals/audio';
import { CRYSTAL_KEY, CRYSTAL_DESIGN_VERSION, defaultCrystalPreparation, crystalPhases, crystalPhaseAt, crystalTimeline, parseCrystalNotebook, readCrystalNotebook, saveCrystalPreparation, saveCrystalSession, appendCrystalFollowUp, importCrystalNotebook, validatePreparation, type CrystalSession } from '../src/lib/crystals/model';
const preparation = () => ({ ...defaultCrystalPreparation(), crystal: 'Cuarzo de prueba', intention: 'Concentración' });
const session = (): CrystalSession => ({ id: 'one', designVersion: CRYSTAL_DESIGN_VERSION, startedAt: '2026-11-23T16:00:00Z', endedAt: '2026-11-23T16:15:00Z', status: 'completed', elapsedMs: 900000, preparation: preparation(), notes: { experience: '', interpretation: '', action: '' }, followUps: [], initialVolume: .12, volumeChanges: [] });
function store(initial: string | null = null) { let raw = initial; return { getItem: (key: string) => { assert.equal(key, CRYSTAL_KEY); return raw; }, setItem: (key: string, value: string) => { assert.equal(key, CRYSTAL_KEY); raw = value; } }; }
class Param { value = 0; events: { type: string; value: number; at: number }[] = []; setValueAtTime(value: number, at: number) { this.value = value; this.events.push({ type: 'set', value, at }); } linearRampToValueAtTime(value: number, at: number) { this.value = value; this.events.push({ type: 'ramp', value, at }); } cancelAndHoldAtTime() {} }
class Node { gain = new Param(); frequency = new Param(); type = 'sine'; starts: number[] = []; stops: number[] = []; disconnected = false; connect() {} disconnect() { this.disconnected = true; } start(at: number) { this.starts.push(at); } stop(at: number) { this.stops.push(at); } }
class Context {
  currentTime = 0; state = 'running'; sampleRate = 48000; destination = {}; onstatechange: (() => void) | null = null;
  oscillators: Node[] = []; gains: Node[] = [];
  createOscillator() { const n = new Node(); this.oscillators.push(n); return n; }
  createGain() { const n = new Node(); this.gains.push(n); return n; }
  async resume() { this.state = 'running'; } async close() { this.state = 'closed'; }
  asAudio() { return this as unknown as AudioContext; }
}
test('10 and 15 minute designs have exact boundaries and a real silent closing phase', () => {
  for (const duration of [10, 15] as const) {
    let at = 0;
    for (const phase of crystalPhases(duration)) {
      assert.equal(crystalPhaseAt(at, duration)?.id, phase.id);
      assert.equal(crystalPhaseAt(at + phase.seconds * 1000 - 1, duration)?.id, phase.id);
      at += phase.seconds * 1000;
    }
    assert.equal(at, duration * 60000); assert.equal(crystalPhaseAt(at, duration), null);
    const timeline = crystalTimeline({ ...preparation(), duration });
    assert.equal(timeline.reduce((n, step) => n + step.seconds, 0), duration * 60);
    assert.deepEqual(timeline.at(-1)?.tones, []);
  }
});
test('score adds and removes exact harmonics with fixed normalization; silent choices emit none', () => {
  const score = crystalTimeline(preparation());
  assert.deepEqual(score.map(s => s.tones.length), [1, 1, 1, 2, 3, 3, 2, 1, 0]);
  assert.deepEqual(score[4].tones.map(t => t.hz), [256, 384, 512]);
  assert.ok(score.every(s => s.tones.reduce((sum, t) => sum + t.level, 0) <= 1));
  assert.ok(crystalTimeline({ ...preparation(), sound: false }).every(s => s.tones.length === 0));
  assert.ok(crystalTimeline({ ...preparation(), exposure: 'voice' }).every(s => s.tones.length === 0));
});
test('preparation validates ranges and requires an explicit piece and intention before playback', () => {
  validatePreparation(defaultCrystalPreparation()); assert.throws(() => validatePreparation(defaultCrystalPreparation(), true));
  for (const patch of [{ baseHz: NaN }, { baseHz: 378394 }, { duration: 12 }, { exposure: 'coil' }, { crystal: null }]) assert.throws(() => validatePreparation({ ...preparation(), ...patch }));
});
test('audio schedules the complete score and finite stops without UI timers', async () => {
  const ctx = new Context(); let stops = 0;
  const audio = new CrystalAudio(() => ctx.asAudio(), () => { stops++; });
  await audio.play(preparation(), .12);
  assert.equal(stops, 1);
  assert.equal(ctx.oscillators.length, 14);
  assert.deepEqual([...new Set(ctx.oscillators.map(n => n.frequency.events[0].value))], [256, 384, 512]);
  assert.ok(ctx.oscillators.every(n => n.stops[0] <= 780.01));
  ctx.currentTime = 810; assert.equal(audio.elapsedMs(), 810000); // Silent tail still advances.
  ctx.currentTime = 1000; assert.equal(audio.elapsedMs(), 900000); audio.dispose();
});
test('pause/resume from stabilization cannot replay earlier phases and excludes paused time', async () => {
  const ctx = new Context(), audio = new CrystalAudio(() => ctx.asAudio());
  await audio.play(preparation(), .12); ctx.currentTime = 700; audio.stop(); assert.equal(audio.elapsedMs(), 700000);
  ctx.currentTime = 1200; assert.equal(audio.elapsedMs(), 700000);
  const old = ctx.oscillators.length; await audio.play(preparation(), .12, 700000);
  assert.deepEqual(ctx.oscillators.slice(old).map(n => n.frequency.events[0].value), [256, 384, 256]);
  ctx.currentTime = 1210; assert.equal(audio.elapsedMs(), 710000); audio.dispose();
});
test('stop invalidates a suspended asynchronous start and releases its pending graph', async () => {
  const ctx = new Context(); ctx.state = 'suspended'; let unlock!: () => void;
  ctx.resume = () => new Promise<void>(resolve => { unlock = () => { ctx.state = 'running'; resolve(); }; });
  const audio = new CrystalAudio(() => ctx.asAudio()); const pending = audio.play(preparation(), .12);
  audio.stop(); unlock(); assert.equal(await pending, false); assert.equal(ctx.oscillators.length, 0); audio.dispose();
});
test('silent practice still uses the native clock; interruptions pause and stop scheduled sources', async () => {
  const ctx = new Context(); let interrupted = 0;
  const audio = new CrystalAudio(() => ctx.asAudio(), () => {}, () => { interrupted++; });
  await audio.play({ ...preparation(), sound: false }, 0); assert.equal(ctx.oscillators.length, 0);
  ctx.currentTime = 60; assert.equal(audio.elapsedMs(), 60000);
  ctx.state = 'suspended'; ctx.onstatechange?.(); assert.equal(interrupted, 1); assert.equal(audio.elapsedMs(), 60000); audio.dispose();
});
test('notebook snapshots are detached and follow-ups append without replacing observations', () => {
  const s = store(), p = preparation(), row = session(); saveCrystalPreparation(s, p); saveCrystalSession(s, row);
  p.intention = 'Changed'; row.preparation.intention = 'Changed';
  const f = { id: 'f', at: '2026-11-23T17:00:00Z', text: 'Una observación' };
  appendCrystalFollowUp(s, 'one', f); appendCrystalFollowUp(s, 'one', f);
  const book = readCrystalNotebook(s); assert.equal(book.preparation?.intention, 'Concentración');
  assert.equal(book.sessions[0].preparation.intention, 'Concentración'); assert.equal(book.sessions[0].followUps.length, 1);
  assert.equal(book.sessions[0].notes.experience, '');
});
test('import merges dated follow-ups, keeps local preparation and rejects conflicting data atomically', () => {
  const s = store(); saveCrystalPreparation(s, { ...preparation(), crystal: 'Local' }); saveCrystalSession(s, session());
  const incoming = session(); incoming.followUps.push({ id: 'f', at: '2026-11-23T17:00:00Z', text: 'Nuevo' });
  const raw = JSON.stringify({ schemaVersion: 1, preparation: preparation(), sessions: [incoming] });
  importCrystalNotebook(s, raw); importCrystalNotebook(s, raw);
  assert.equal(readCrystalNotebook(s).sessions[0].followUps.length, 1); assert.equal(readCrystalNotebook(s).preparation?.crystal, 'Local');
  const before = s.getItem(CRYSTAL_KEY); incoming.preparation.intention = 'Other';
  assert.throws(() => importCrystalNotebook(s, JSON.stringify({ schemaVersion: 1, preparation: null, sessions: [incoming] })));
  assert.equal(s.getItem(CRYSTAL_KEY), before);
});
test('malformed, unsupported and conflicting notebooks remain untouched; explicit zeros round-trip', () => {
  for (const raw of ['broken', '{}', JSON.stringify({ schemaVersion: 2, preparation: null, sessions: [] })]) {
    const s = store(raw); assert.throws(() => saveCrystalPreparation(s, preparation())); assert.equal(s.getItem(CRYSTAL_KEY), raw);
  }
  const row = session(); row.status = 'stopped'; row.elapsedMs = 0; row.initialVolume = 0;
  const s = store(); saveCrystalSession(s, row); assert.equal(readCrystalNotebook(s).sessions[0].initialVolume, 0);
  assert.throws(() => parseCrystalNotebook(JSON.stringify({ schemaVersion: 1, preparation: null, sessions: [{ ...row, status: 'completed' }] })));
  assert.throws(() => saveCrystalSession(s, { ...row, notes: { ...row.notes, experience: 'Conflict' } }));
});


test('coils preserves the bounded audio score and round-trips as an output choice', async () => {
  const p = { ...preparation(), exposure: 'coils' as const };
  validatePreparation(p, true);
  assert.deepEqual(crystalTimeline(p), crystalTimeline(preparation()));
  const s = store(), row = { ...session(), preparation: p };
  saveCrystalSession(s, row);
  const destination = store(); importCrystalNotebook(destination, s.getItem(CRYSTAL_KEY)!);
  assert.equal(readCrystalNotebook(destination).sessions[0].preparation.exposure, 'coils');
  const ctx = new Context(), audio = new CrystalAudio(() => ctx.asAudio());
  await audio.play(p, .12);
  assert.deepEqual([...new Set(ctx.oscillators.map(n => n.frequency.events[0].value))], [256, 384, 512]);
  audio.dispose();
});
