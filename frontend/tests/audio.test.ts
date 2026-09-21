import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserAudioContext, HarmonicEngine } from '../src/lib/harmonic/engine';
import type { HarmonicConfig } from '../src/lib/harmonic/math';
const config: HarmonicConfig = { baseHz: 220, ratioId: 'fifth', increments: 3, direction: 'ascending', mode: 'sequence', durationSeconds: 300, uiVolume: 20, waveform: 'sine' };
class Param {
  value = 0; events: number[][] = [];
  setValueAtTime(v: number, t: number) { this.value = v; this.events.push([v, t]); }
  linearRampToValueAtTime(v: number, t: number) { this.value = v; this.events.push([v, t]); }
  cancelAndHoldAtTime(t: number) { this.events.push([-1, t]); }
}
class Node { disconnected = false; connect() {} disconnect() { this.disconnected = true; } }
class Gain extends Node { gain = new Param(); }
class Osc extends Node { type = ''; frequency = new Param(); onended: (() => void) | null = null; starts: number[] = []; stops: number[] = []; start(t: number) { this.starts.push(t); } stop(t: number) { this.stops.push(t); } }
export class FakeContext {
  currentTime = 0; state = 'running'; destination = new Node(); oscs: Osc[] = []; gains: Gain[] = [];
  resume: () => Promise<void> = async () => {};
  close = async () => { this.state = 'closed'; };
  createGain() { const g = new Gain(); this.gains.push(g); return g; }
  createOscillator() { const o = new Osc(); this.oscs.push(o); return o; }
}
test('browser context uses webkit fallback when standard AudioContext is unavailable', () => {
  const scope = globalThis as typeof globalThis & { AudioContext?: unknown; webkitAudioContext?: unknown };
  const originalAudioContext = Object.getOwnPropertyDescriptor(scope, 'AudioContext');
  const originalWebkitAudioContext = Object.getOwnPropertyDescriptor(scope, 'webkitAudioContext');
  class WebKitContext extends FakeContext {}
  try {
    Object.defineProperty(scope, 'AudioContext', { configurable: true, value: undefined });
    Object.defineProperty(scope, 'webkitAudioContext', { configurable: true, value: WebKitContext });
    assert.ok(createBrowserAudioContext() instanceof WebKitContext);
  } finally {
    if (originalAudioContext) Object.defineProperty(scope, 'AudioContext', originalAudioContext);
    else Reflect.deleteProperty(scope, 'AudioContext');
    if (originalWebkitAudioContext) Object.defineProperty(scope, 'webkitAudioContext', originalWebkitAudioContext);
    else Reflect.deleteProperty(scope, 'webkitAudioContext');
  }
});
test('resume cancellation cannot create a late graph', async () => {
  const ctx = new FakeContext(); let resolve!: () => void;
  ctx.state = 'suspended';
  ctx.resume = () => new Promise<void>(r => { resolve = r; });
  const e = new HarmonicEngine(() => ctx as unknown as AudioContext);
  const pending = e.start(config); e.stop(); resolve(); assert.equal(await pending, false);
  assert.equal(ctx.oscs.length, 0); assert.equal(ctx.state, 'closed'); e.dispose();
});
test('audio clock schedule, stop cancels future nodes, callback A cannot finish B', async () => {
  const contexts: FakeContext[] = [];
  const e = new HarmonicEngine(() => { const c = new FakeContext(); contexts.push(c); return c as unknown as AudioContext; });
  let completed = 0; await e.start(config, () => completed++); const a = contexts[0]; const late = a.oscs[1].onended!;
  assert.deepEqual(a.oscs.map(o => o.starts[0]), [0.01, 150.01]);
  await e.start(config); late(); assert.equal(completed, 0); assert.equal(e.isPlaying(), true);
  assert.ok(a.oscs.every(o => o.stops.at(-1) === 0.03));
  e.stop(); e.stop(); assert.equal(e.isPlaying(), false);
});
test('duck is a separate factor, cancellation resolves wait and cannot restore audio', async () => {
  const ctx = new FakeContext(); const e = new HarmonicEngine(() => ctx as unknown as AudioContext);
  await e.start({ ...config, mode: 'simultaneous' });
  assert.equal(ctx.gains[1].gain.events[1][0], 1 / 2);
  const pending = e.duck(); assert.equal(ctx.gains[0].gain.value, 0.0125); assert.equal(e.getVolume(), 20);
  e.stop(); assert.equal(await pending, false); e.restore(); assert.equal(ctx.gains[0].gain.value, 0);
});
test('normal completion disconnects/ closes context once, including previously ended steps', async () => {
  const ctx = new FakeContext(); const e = new HarmonicEngine(() => ctx as unknown as AudioContext);
  let completed = 0; await e.start(config, () => completed++);
  ctx.oscs[0].onended!(); ctx.oscs[1].onended!();
  assert.equal(completed, 1); assert.equal(ctx.state, 'closed'); assert.ok(ctx.oscs.every(o => o.disconnected));
});
test('resume rejection is recoverable', async () => {
  const ctx = new FakeContext(); ctx.resume = async () => { throw new Error('blocked'); };
  ctx.state = 'suspended';
  const e = new HarmonicEngine(() => ctx as unknown as AudioContext);
  await assert.rejects(e.start(config), /No se pudo/); assert.equal(ctx.state, 'closed');
});
test('suspended context that cannot become running is rejected instead of reporting playback', async () => {
  const ctx = new FakeContext(); ctx.state = 'suspended';
  ctx.resume = async () => {};
  const e = new HarmonicEngine(() => ctx as unknown as AudioContext);
  await assert.rejects(e.start(config), /No se pudo/);
  assert.equal(e.isPlaying(), false);
  assert.equal(ctx.oscs.length, 0);
  assert.equal(ctx.state, 'closed');
});
