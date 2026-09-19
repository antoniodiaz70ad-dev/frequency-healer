import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../src/lib/audioEngine';
class Param { value = 0; setValueAtTime(v: number) { this.value = v; } }
class Node { stopped = false; disconnected = false; type = ''; frequency = new Param(); gain = new Param(); pan = new Param(); buffer: unknown; loop = false; fftSize = 2048; frequencyBinCount = 1024; connect() {} disconnect() { this.disconnected = true; } start() {} stop() { this.stopped = true; } getFloatTimeDomainData() {} getByteFrequencyData() {} }
class Context {
  state = 'running'; currentTime = 0; sampleRate = 100; destination = { maxChannelCount: 2 }; oscs: Node[] = []; pans: Node[] = []; noises: Node[] = [];
  resume = async () => {}; close = async () => { this.state = 'closed'; };
  createOscillator() { const n = new Node(); this.oscs.push(n); return n; }
  createGain() { return new Node(); } createAnalyser() { return new Node(); }
  createStereoPanner() { const n = new Node(); this.pans.push(n); return n; }
  createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
  createBufferSource() { const n = new Node(); this.noises.push(n); return n; }
}
test('legacy API regression: tone, 432, binaural, coils, chords, noise and destroy', () => {
  const contexts: Context[] = [];
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: class extends Context { constructor() { super(); contexts.push(this); } } });
  const engine = new AudioEngine();
  engine.play(432, 'sine', .1); assert.equal(engine.getIsPlaying(), true); assert.equal(contexts[0].oscs[0].frequency.value, 432);
  assert.equal(AudioEngine.to432(440), 432); engine.stop(); assert.equal(engine.getIsPlaying(), false);
  engine.setOutputMode('coils'); engine.play(220, 'sine', .1, { enabled: true, differenceHz: 10 });
  assert.deepEqual(contexts[0].oscs.slice(-2).map(o => o.frequency.value), [220, 230]); assert.deepEqual(contexts[0].pans.map(p => p.pan.value), [-1, 1]);
  engine.stop(); engine.playChord([{ carrierHz: 100, beatHz: 4, gain: .5, waveform: 'sine' }], { masterVolume: .1, pinkNoiseGain: .05 });
  assert.equal(contexts[0].noises.length, 1); engine.destroy(); assert.equal(contexts[0].state, 'closed');
  assert.ok(contexts[0].oscs.every(o => o.stopped && o.disconnected)); assert.ok(contexts[0].noises.every(n => n.stopped));
});
