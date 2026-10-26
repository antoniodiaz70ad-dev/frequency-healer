import test from 'node:test';
import assert from 'node:assert/strict';
import { AteneaSession } from '../src/lib/atenea/session';
import { MockVoiceAdapter, MockAnalysisAdapter } from '../src/lib/atenea/mock';
import { authorize } from '../src/lib/atenea/access';
import type { AnalysisAdapter, VoiceEvent } from '../src/lib/atenea/contracts';

function fixture(analysis: AnalysisAdapter = new MockAnalysisAdapter()) {
  const voice = new MockVoiceAdapter();
  let stops = 0;
  const track = { stop: () => { stops++; }, enabled: true, onended: null as (() => void) | null };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  const session = new AteneaSession(voice, analysis, { open: async () => stream });
  const say = (text: string, final = true) => voice.simulate({ type: 'transcript', text, final });
  return { voice, session, track, stream, say, stops: () => stops };
}

test('no consent means no permission, connection or persistence', async () => {
  const f = fixture(); await f.session.start('diario', false, true);
  assert.equal(f.session.getSnapshot().state, 'idle'); assert.equal(f.voice.spoken.length, 0);
  assert.equal(f.session.approvedExport(), null);
});
test('all three modes start without microphone and close cleanly', async () => {
  for (const mode of ['observador', 'decision', 'diario'] as const) {
    const f = fixture(); await f.session.start(mode, true, false);
    assert.equal(f.session.getSnapshot().mode, mode); assert.equal(f.session.getSnapshot().microphone, false);
    f.say('ATENEA, terminar'); assert.equal(f.session.getSnapshot().state, 'ended');
  }
});
test('double start does not request a second microphone', async () => {
  const f = fixture(); await Promise.all([f.session.start('observador', true, true), f.session.start('diario', true, true)]);
  assert.equal(f.session.getSnapshot().mode, 'observador'); f.session.end(); assert.equal(f.stops(), 1);
});
test('late microphone permission after stop closes returned tracks', async () => {
  const f = fixture(); let resolve!: (value: MediaStream) => void;
  const session = new AteneaSession(f.voice, new MockAnalysisAdapter(), { open: () => new Promise(r => { resolve = r; }) });
  const starting = session.start('diario', true, true); session.end(); resolve(f.stream); await starting;
  assert.equal(f.stops(), 1); assert.equal(session.getSnapshot().state, 'ended'); assert.equal(f.voice.spoken.length, 0);
});
test('microphone rejection is recoverable without microphone', async () => {
  const voice = new MockVoiceAdapter();
  const session = new AteneaSession(voice, new MockAnalysisAdapter(), { open: async () => { throw new Error('denied'); } });
  await session.start('diario', true, true); assert.equal(session.getSnapshot().state, 'error');
  await session.start('diario', true, false); assert.equal(session.getSnapshot().state, 'active'); session.end();
});
test('pause mutes input, continue restores it, verbal end closes hardware', async () => {
  const f = fixture(); await f.session.start('observador', true, true);
  f.say('pausa'); assert.equal(f.track.enabled, false); assert.equal(f.session.getSnapshot().microphone, false);
  f.say('continúa'); assert.equal(f.track.enabled, true);
  f.say('terminar'); assert.equal(f.stops(), 1); assert.equal(f.track.onended, null);
  assert.equal(f.session.getSnapshot().microphone, false); assert.equal(f.voice.spoken.length, 0);
});
test('explicit restart after ending while paused resets the adapter and consent', async () => {
  const f = fixture(); await f.session.start('diario', true, false);
  f.say('guarda solo el resumen'); f.session.pause(); f.session.end();
  await f.session.start('observador', true, false);
  assert.equal(f.voice.spoken.length, 1); assert.equal(f.session.approvedExport(), null); f.session.end();
});
test('60 seconds of silence does not speak, disconnect or grant consent', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(); await f.session.start('observador', true, false); f.say('más silencio');
  const count = f.voice.spoken.length; t.mock.timers.tick(60_000);
  assert.equal(f.voice.spoken.length, count); assert.equal(f.session.getSnapshot().state, 'active');
  assert.equal(f.session.approvedExport(), null); f.session.end();
});
test('speech immediately interrupts output; partial recognition never terminates', async () => {
  const f = fixture(); await f.session.start('diario', true, false);
  f.voice.simulate({ type: 'speech_started' }); assert.equal(f.voice.interruptions, 1);
  f.say('terminar', false); assert.equal(f.session.getSnapshot().state, 'active');
  f.say('hoy pienso terminar el trabajo'); assert.equal(f.session.getSnapshot().state, 'active'); f.session.end();
});
test('disconnect and hardware loss close resources, require explicit restart', async () => {
  for (const hardware of [false, true]) {
    const f = fixture(); await f.session.start('diario', true, true);
    if (hardware) f.track.onended?.(); else f.voice.simulate({ type: 'disconnected' });
    assert.equal(f.session.getSnapshot().state, 'error'); assert.equal(f.stops(), 1);
    f.say('continúa'); assert.equal(f.session.getSnapshot().state, 'error');
  }
});
test('pro requires explicit confirmation; per-session analysis budget is capped', async () => {
  const calls: string[] = [];
  const f = fixture({ analyze: async input => { calls.push(input.level); return 'Resultado simulado'; } });
  await f.session.start('decision', true, false);
  f.say('confirmar profundizar'); assert.deepEqual(calls, []);
  f.say('Necesito decidir entre dos opciones'); f.say('profundiza'); assert.deepEqual(calls, []);
  f.say('confirmar profundizar'); await Promise.resolve(); assert.deepEqual(calls, ['pro']);
  f.say('profundiza'); f.say('confirmar profundizar'); await Promise.resolve(); assert.equal(calls.length, 1);
  for (let i = 0; i < 4; i++) { f.say('analiza'); await Promise.resolve(); }
  assert.deepEqual(calls, ['pro', 'standard', 'standard']); f.session.end();
});
test('late analysis cannot speak after termination', async () => {
  let resolve!: (answer: string) => void;
  const f = fixture({ analyze: () => new Promise(r => { resolve = r; }) });
  await f.session.start('decision', true, false); f.say('contexto'); f.say('analiza'); f.session.end();
  resolve('Respuesta tardía'); await Promise.resolve(); assert.deepEqual(f.voice.spoken, []);
});
test('silence cancels pending analysis rather than filling the pause with an answer', async () => {
  let resolve!: (answer: string) => void;
  const f = fixture({ analyze: () => new Promise(r => { resolve = r; }) });
  await f.session.start('decision', true, false); f.say('contexto'); f.say('analiza'); f.say('más silencio');
  const count = f.voice.spoken.length; resolve('Respuesta tardía'); await Promise.resolve();
  assert.equal(f.voice.spoken.length, count); assert.match(f.session.getSnapshot().message, /Silencio/); f.session.end();
});
test('only edited approved summary can be exported, no transcript; revoke clears it', async () => {
  const f = fixture(); await f.session.start('diario', true, false); f.say('contenido privado');
  f.session.editSummary('Resumen elegido'); assert.equal(f.session.approvedExport(), null);
  f.say('guarda solo el resumen'); assert.deepEqual(f.session.approvedExport(), { version: 'atenea-local-summary-v1', mode: 'diario', consentScope: 'summary', summary: 'Resumen elegido' });
  f.say('no guardar'); assert.equal(f.session.approvedExport(), null); assert.equal(f.session.getSnapshot().summary, ''); f.session.end();
});
test('hard duration cap closes mic without automatic reconnection', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); const f = fixture(); await f.session.start('diario', true, true);
  t.mock.timers.tick(600_000); assert.equal(f.session.getSnapshot().state, 'ended'); assert.equal(f.stops(), 1);
});
test('late adapter events are ignored after close', async () => {
  let emit!: (event: VoiceEvent) => void;
  const f = fixture(); const voice = new MockVoiceAdapter();
  voice.connect = async (_stream, _signal, callback) => { emit = callback; };
  const session = new AteneaSession(voice, new MockAnalysisAdapter());
  await session.start('observador', true, false); session.end(); emit({ type: 'disconnected' });
  assert.equal(session.getSnapshot().state, 'ended'); f.session.end();
});
test('server gate rejects flag off, foreign/missing origins, missing auth binding and anonymous users', async () => {
  const request = (origin?: string) => new Request('https://example.test/api/atenea-voz/session', { method: 'POST', headers: origin ? { origin } : {} });
  assert.equal(await authorize(request('https://example.test'), false), 404);
  assert.equal(await authorize(request(), true), 403);
  assert.equal(await authorize(request('https://foreign.test'), true), 403);
  assert.equal(await authorize(request('https://example.test'), true), 503);
  assert.equal(await authorize(request('https://example.test'), true, { authenticate: async () => null, reserve: async () => true }), 401);
});
