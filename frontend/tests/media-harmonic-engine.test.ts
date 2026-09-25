import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSchedule, type HarmonicConfig } from '../src/lib/harmonic/math';
import { IOS_BACKGROUND_MAX_SECONDS, isIOSLike, renderHarmonicConfigToWavBlob } from '../src/lib/voice/mediaHarmonicEngine';

const config: HarmonicConfig = {
  baseHz: 256,
  ratioId: 'fifth',
  increments: 1,
  direction: 'ascending',
  mode: 'sequence',
  durationSeconds: 2,
  uiVolume: 30,
  waveform: 'sine',
  progression: ['root', 'fifth'],
};

test('detects iOS-like browsers without marking Android as iOS', () => {
  assert.equal(isIOSLike('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15'), true);
  assert.equal(isIOSLike('Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 Chrome/125 Mobile Safari/537.36'), false);
});

test('renders guided harmonic config to a WAV blob from the existing schedule', async () => {
  const { blob, schedule } = renderHarmonicConfigToWavBlob(config);
  assert.deepEqual(schedule, buildSchedule(config));
  assert.equal(blob.type, 'audio/wav');
  assert.ok(blob.size > 44);
  const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  assert.equal(String.fromCharCode(...header.slice(0, 4)), 'RIFF');
  assert.equal(String.fromCharCode(...header.slice(8, 12)), 'WAVE');
});

test('rejects iPhone media rendering above the V1 background duration limit', () => {
  assert.throws(() => renderHarmonicConfigToWavBlob({ ...config, durationSeconds: IOS_BACKGROUND_MAX_SECONDS + 1 }), /hasta 30 minutos/);
});
