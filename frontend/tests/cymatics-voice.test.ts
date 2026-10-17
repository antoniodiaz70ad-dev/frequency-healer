import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPitch } from '../src/lib/cymatics/pitch';
import { voiceReading, voiceInputRms, compareVoiceFrequency } from '../src/lib/cymatics/voice';
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

test('quiet microphone voice is detected without accepting DC or silence', () => {
  const quiet = Float32Array.from(vocal(165), value => value * .01);
  assert.ok(voiceInputRms(quiet) > .001);
  assert.equal(detectPitch(quiet, rate), null);
  const reading = voiceReading(detectPitch(quiet, rate, 80, 1200, .001), 1, .001);
  assert.ok(reading); assert.ok(Math.abs(reading.frequencyHz - 165) < 2);
  assert.equal(voiceInputRms(new Float32Array(4096).fill(.5)), 0);
  assert.equal(voiceReading(detectPitch(new Float32Array(4096), rate, 80, 1200, .001), 2, .001), null);
});

test('low vocal pitch at 65 Hz is supported by voice mode', () => {
  const reading = voiceReading(detectPitch(vocal(65), rate, 60, 1200, .001), 1, .001);
  assert.ok(reading); assert.ok(Math.abs(reading.frequencyHz - 65) < 1);
});

test('voice expansion preserves raw pitch and rejects overflow without clamping', async () => {
  const { expandVoiceFrequency } = await import('../src/lib/cymatics/voice');
  assert.equal(expandVoiceFrequency(150, 1), 150);
  assert.equal(expandVoiceFrequency(150, 2), 300);
  assert.equal(expandVoiceFrequency(150, 4), 600);
  assert.equal(expandVoiceFrequency(150, 8), 1200);
  assert.equal(expandVoiceFrequency(250, 8), 2000);
  assert.equal(expandVoiceFrequency(330, 8), null);
  assert.equal(expandVoiceFrequency(NaN, 4), null);
});
