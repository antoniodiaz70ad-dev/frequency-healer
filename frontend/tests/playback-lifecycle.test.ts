import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { playbackWakeLockMessage, requestScreenWakeLock, supportsScreenWakeLock } from '../src/lib/playbackLifecycle';

test('playback wake lock detection is explicit and safe when unsupported', async () => {
  assert.equal(supportsScreenWakeLock(undefined), false);
  assert.equal(supportsScreenWakeLock({}), false);
  assert.equal(await requestScreenWakeLock(undefined), null);
  assert.equal(playbackWakeLockMessage('idle'), '');
  assert.match(playbackWakeLockMessage('unsupported'), /iPhone/);
});

test('playback wake lock requests only screen locks and returns the sentinel', async () => {
  const calls: string[] = [];
  const sentinel = { released: false, release: async () => { sentinel.released = true; } };
  const result = await requestScreenWakeLock({ wakeLock: { request: async type => { calls.push(type); return sentinel; } } });
  assert.equal(result, sentinel);
  assert.deepEqual(calls, ['screen']);
});

test('mobile playback surfaces no longer stop sessions merely because document becomes hidden', () => {
  for (const file of ['src/components/voice/VoiceJourney.tsx', 'src/components/voice/HarmonicLab.tsx']) {
    const source = readFileSync(file, 'utf8');
    assert.equal(source.includes("flow.stop('hidden')"), false, file);
    assert.equal(source.includes('if (document.hidden) stop()'), false, file);
    assert.match(source, /pagehide/, file);
  }
});
