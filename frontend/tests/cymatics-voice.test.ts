import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPitch } from '../src/lib/cymatics/pitch';
import { voiceReading, compareVoiceFrequency } from '../src/lib/cymatics/voice';
const rate = 48000;
const vocal = (hz: number) => Float32Array.from({length: 4096}, (_, i) => .3 * Math.sin(2*Math.PI*hz*i/rate) + .12 * Math.sin(4*Math.PI*hz*i/rate) + .07 * Math.sin(6*Math.PI*hz*i/rate));
for (const hz of [110, 165, 220, 330, 432]) test(`vocal harmonic mixture tracks fundamental ${hz} Hz`, () => {
  const reading = voiceReading(detectPitch(vocal(hz), rate), 100);
  assert.ok(reading); assert.ok(Math.abs(reading.frequencyHz-hz)/hz < .01); assert.equal(reading.measuredAt, 100);
});
test('silence and low-confidence input do not reuse a previous voice reading', () => {
  assert.ok(voiceReading(detectPitch(vocal(220), rate), 100));
  assert.equal(voiceReading(detectPitch(new Float32Array(4096), rate), 200), null);
  assert.equal(voiceReading({frequencyHz: 220, confidence: .8, rms: .1}, 200), null);
});
test('frequency comparison distinguishes unison, octave and invalid reference', () => {
  assert.deepEqual(compareVoiceFrequency(432, 432), {differenceHz: 0, semitones: 0});
  assert.deepEqual(compareVoiceFrequency(220, 110), {differenceHz: 110, semitones: 12});
  assert.equal(compareVoiceFrequency(220, 440)?.semitones, -12);
  assert.equal(compareVoiceFrequency(0, 432), null);
  assert.equal(compareVoiceFrequency(NaN, 432), null);
});
