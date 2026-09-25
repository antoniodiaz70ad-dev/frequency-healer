import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NativeSpeechController, supportsNativeSpeechRecognition } from '../src/lib/voice/nativeSpeech';

class Recognition {
  static instance: Recognition | null = null;
  lang = ''; continuous = true; interimResults = false; maxAlternatives = 0;
  onaudioend: ((event: Event) => void) | null = null;
  onend: ((event: Event) => void) | null = null;
  onerror: ((event: Event & { error?: string; message?: string }) => void) | null = null;
  onresult: ((event: { resultIndex: number; results: Array<{ 0: { transcript: string; confidence?: number }; length: number; isFinal: boolean; item: () => { transcript: string; confidence?: number } }> }) => void) | null = null;
  onstart: ((event: Event) => void) | null = null;
  aborted = false; stopped = false;
  constructor() { Recognition.instance = this; }
  start() { this.onstart?.(new Event('start')); }
  stop() { this.stopped = true; this.onend?.(new Event('end')); }
  abort() { this.aborted = true; this.onend?.(new Event('end')); }
}

test('native speech support detects webkitSpeechRecognition and returns transcript', async () => {
  Object.defineProperty(globalThis, 'webkitSpeechRecognition', { configurable: true, value: Recognition });
  assert.equal(supportsNativeSpeechRecognition(), true);
  const c = new NativeSpeechController(); let listening = false;
  const p = c.listen(new AbortController().signal, () => { listening = true; });
  const instance = Recognition.instance!;
  assert.equal(listening, true); assert.equal(instance.lang, 'es-MX'); assert.equal(instance.continuous, false);
  instance.onresult?.({ resultIndex: 0, results: [{ 0: { transcript: 'quiero calma', confidence: 0.9 }, length: 1, isFinal: true, item: () => ({ transcript: 'quiero calma', confidence: 0.9 }) }] });
  instance.stop();
  assert.deepEqual(await p, { text: 'quiero calma', confidence: 0.9 });
});

test('native speech abort is recoverable and empty speech is rejected', async () => {
  Object.defineProperty(globalThis, 'webkitSpeechRecognition', { configurable: true, value: Recognition });
  const c = new NativeSpeechController();
  const ac = new AbortController(); const aborted = c.listen(ac.signal, () => {}); ac.abort(); await assert.rejects(aborted, { name: 'AbortError' });
  const empty = c.listen(new AbortController().signal, () => {}); Recognition.instance!.stop(); await assert.rejects(empty, /No se detectó voz/);
});
