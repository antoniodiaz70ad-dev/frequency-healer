import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoiceCaptureController, validateVoiceBlob, MAX_AUDIO_BYTES } from '../src/lib/voice/capture';
class Recorder {
  static instances: Recorder[] = []; static isTypeSupported() { return true; }
  state = 'inactive'; ondataavailable: ((v: { data: Blob }) => void) | null = null; onstop: (() => void) | null = null; onerror: (() => void) | null = null;
  constructor() { Recorder.instances.push(this); }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['sound'], { type: 'audio/webm' }) }); this.onstop?.(); }
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test('capture never requests microphone at construction; one stream; release stops every track', async () => {
  let requested = 0, stopped = 0;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: async () => { requested++; return { getTracks: () => [{ stop: () => stopped++ }, { stop: () => stopped++ }] }; } } } });
  Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, value: Recorder });
  const c = new VoiceCaptureController(); assert.equal(requested, 0);
  const p = c.capture('intention', new AbortController().signal, () => {}); await tick();
  await assert.rejects(c.capture('intention', new AbortController().signal, () => {}), /activa/);
  c.stop(); const audio = await p; assert.equal(requested, 1); assert.equal(stopped, 2); assert.ok(audio.blob.size > 0); c.cancel();
});
test('late permission after cancellation closes stream and cannot start recorder', async () => {
  let resolve!: (v: unknown) => void, stopped = 0;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: () => new Promise(r => { resolve = r; }) } } });
  const c = new VoiceCaptureController(), ac = new AbortController();
  const p = c.capture('marker', ac.signal, () => assert.fail('late listening')); ac.abort();
  resolve({ getTracks: () => [{ stop: () => stopped++ }] }); await assert.rejects(p, { name: 'AbortError' }); assert.equal(stopped, 1);
});
test('cancel/error ends tracks, drops buffers and releases capture for another run', async () => {
  let stopped = 0;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => stopped++ }] }) } } });
  const c = new VoiceCaptureController();
  const p = c.capture('marker', new AbortController().signal, () => {}); await tick(); c.cancel(); await assert.rejects(p, { name: 'AbortError' }); assert.equal(stopped, 1);
  const second = c.capture('reflection', new AbortController().signal, () => {}); await tick(); Recorder.instances.at(-1)!.onerror!(); await assert.rejects(second, /grabar/); assert.equal(stopped, 2);
});
test('mime, size and per-kind duration limits reject invalid audio', () => {
  const good = { kind: 'intention' as const, durationMs: 1000, blob: new Blob(['x'], { type: 'audio/webm' }) };
  validateVoiceBlob(good);
  assert.throws(() => validateVoiceBlob({ ...good, blob: new Blob(['x'], { type: 'text/plain' }) }));
  assert.throws(() => validateVoiceBlob({ ...good, durationMs: 60001 }));
  assert.throws(() => validateVoiceBlob({ ...good, kind: 'marker', durationMs: 30001 }));
  assert.throws(() => validateVoiceBlob({ ...good, blob: new Blob([new Uint8Array(MAX_AUDIO_BYTES + 1)], { type: 'audio/webm' }) }));
});
test('denied permission and unavailable APIs are recoverable without recording', async () => {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: async () => { throw new DOMException('Denied', 'NotAllowedError'); } } } });
  const c = new VoiceCaptureController(); await assert.rejects(c.capture('intention', new AbortController().signal, () => {}), { name: 'NotAllowedError' });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
  await assert.rejects(c.capture('intention', new AbortController().signal, () => {}), /texto/);
});
