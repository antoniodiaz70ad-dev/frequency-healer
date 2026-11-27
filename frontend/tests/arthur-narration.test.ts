import assert from 'node:assert/strict';
import test from 'node:test';
import { ArthurNarration, guideCues, type GuideTimeline } from '../src/lib/narration/arthur';
import { ARTHUR_GUIDES } from '../src/lib/narration/manifest';
import { crystalPhases } from '../src/lib/crystals/model';
import { MARINA_PHASES, MARINA_CREATION_PHASES } from '../src/lib/marina/model';

class Param {
  value = 0; changes: number[] = [];
  setValueAtTime(value: number) { this.value = value; this.changes.push(value); }
  linearRampToValueAtTime(value: number) { this.value = value; this.changes.push(value); }
  setTargetAtTime(value: number) { this.value = value; this.changes.push(value); }
}
class Node {
  gain = new Param(); buffer: AudioBuffer | null = null; starts: number[][] = []; stopped = false; disconnected = false;
  connect() {} disconnect() { this.disconnected = true; }
  start(...args: number[]) { this.starts.push(args); } stop() { this.stopped = true; }
}
class Context {
  currentTime = 25; destination = {}; sources: Node[] = []; gains: Node[] = []; decodes = 0;
  createGain() { const node = new Node(); this.gains.push(node); return node; }
  createBufferSource() { const node = new Node(); this.sources.push(node); return node; }
  async decodeAudioData() { this.decodes++; return { duration: 8 } as AudioBuffer; }
  asAudio() { return this as unknown as AudioContext; }
}
const timeline = (): GuideTimeline => ({ volume: .7, cues: [{ key: 'crystals-prepare', atMs: 0, endMs: 120000 }, { key: 'crystals-define', atMs: 120000, endMs: 180000 }] });
test('assets retain exact public guide wording and explicitly expose available coverage', () => {
  const phases = [...crystalPhases(10).map(p => ({ ...p, key: `crystals-${p.id}` })), ...MARINA_PHASES.map(p => ({ ...p, key: `marina-${p.id}` })), ...MARINA_CREATION_PHASES.map(p => ({ ...p, key: `marina-${p.id}` }))];
  for (const guide of ARTHUR_GUIDES) assert.equal(guide.text, phases.find(p => p.key === guide.key)?.guide);
  assert.equal(ARTHUR_GUIDES.filter(g => g.src).length, 9);
  assert.deepEqual(guideCues(crystalPhases(10), 'crystals').map(c => c.atMs), [0, 120000, 180000, 420000, 540000]);
  assert.equal(guideCues(MARINA_PHASES, 'marina', ['zero']).length, 3);
  assert.equal(guideCues(MARINA_CREATION_PHASES, 'marina').length, 0);
});
test('same-origin files decode once per context, independent voice gain and native offsets survive resume', async () => {
  const ctx = new Context(), calls: string[] = [];
  const fetcher: typeof fetch = async (url, init) => { calls.push(String(url)); assert.equal(init?.credentials, 'same-origin'); assert.equal(init?.cache, 'force-cache'); return new Response(new Uint8Array([1])); };
  const voice = new ArthurNarration(fetcher), controller = new AbortController(), score = timeline();
  const buffers = await voice.prepare(ctx.asAudio(), score, controller.signal);
  assert.equal(calls.length, 2); assert.ok(calls.every(url => url.startsWith('/audio/arthur-es-v1/') && !url.includes('?')));
  voice.schedule(ctx.asAudio(), score, buffers, 2500, 25);
  assert.deepEqual(ctx.sources.map(s => s.starts[0]), [[25, 2.5, 5.5], [142.5, 0, 8]]);
  voice.setVolume(.2); assert.equal(ctx.gains[0].gain.value, .2);
  voice.stop(); assert.ok(ctx.sources.every(s => s.stopped && s.disconnected));
  await voice.prepare(ctx.asAudio(), score, controller.signal); assert.equal(calls.length, 2);
  voice.schedule(ctx.asAudio(), score, buffers, 10000, 40);
  assert.equal(ctx.sources.length, 3); assert.deepEqual(ctx.sources[2].starts[0], [150, 0, 8]);
  voice.stop();
});
test('late fetch completion after cancellation cannot schedule or retain an active graph', async () => {
  const ctx = new Context(); let deliver!: (value: Response) => void;
  const fetcher: typeof fetch = () => new Promise(resolve => { deliver = resolve; });
  const voice = new ArthurNarration(fetcher), controller = new AbortController();
  const pending = voice.prepare(ctx.asAudio(), timeline(), controller.signal);
  controller.abort(); voice.stop(); deliver(new Response(new Uint8Array([1])));
  await assert.rejects(pending, /cancel/); assert.equal(ctx.sources.length, 0);
});
test('unavailable clips, bad timing, non-finite volume and HTTP failures do not synthesize a fallback', async () => {
  const ctx = new Context(), controller = new AbortController(); let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return new Response('Not found', { status: 404 }); };
  const voice = new ArthurNarration(fetcher);
  await assert.rejects(voice.prepare(ctx.asAudio(), { ...timeline(), volume: NaN }, controller.signal), /volumen/);
  await assert.rejects(voice.prepare(ctx.asAudio(), { volume: .7, cues: [{ key: 'missing', atMs: 0, endMs: 10 }] }, controller.signal), /disponible/);
  assert.equal(calls, 0);
  await assert.rejects(voice.prepare(ctx.asAudio(), timeline(), controller.signal), /cargar Arthur/);
  assert.equal(ctx.sources.length, 0); assert.throws(() => voice.setVolume(NaN));
});
test('recordings are clipped to the current phase boundary even with a longer buffer', async () => {
  const ctx = new Context(), voice = new ArthurNarration(async () => new Response(new Uint8Array([1])));
  const score: GuideTimeline = { volume: .5, cues: [{ key: 'crystals-prepare', atMs: 0, endMs: 2000 }] };
  const buffers = await voice.prepare(ctx.asAudio(), score, new AbortController().signal);
  voice.schedule(ctx.asAudio(), score, buffers, 1500, 30);
  assert.deepEqual(ctx.sources[0].starts[0], [30, 1.5, .5]); voice.stop();
});
