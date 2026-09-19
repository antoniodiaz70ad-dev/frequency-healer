import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSchedule, cascade, frequency, masterGain, voiceGain, type HarmonicConfig } from '../src/lib/harmonic/math';
export const config: HarmonicConfig = { baseHz: 220, ratioId: 'fifth', increments: 3, direction: 'ascending', mode: 'sequence', durationSeconds: 300, uiVolume: 20, waveform: 'sine' };
test('exact rational intervals and cascade precision / counts', () => {
  assert.equal(frequency(220, 3, 2), 330); assert.equal(frequency(220, 4, 3), 293.3333333333333);
  assert.equal(frequency(220, 5, 4), 275); assert.equal(frequency(220, 6, 5), 264);
  const expected = [220, 238.33333333333331, 258.1944444444444, 279.7106481481481];
  cascade(220, 3, 'ascending').forEach((f, i) => assert.ok(Math.abs(f - expected[i]) < 1e-9));
  cascade(220, 3, 'descending').forEach((f, i) => assert.ok(Math.abs(f - 220 * (13 / 12) ** -i) < 1e-9));
  const back = cascade(220, 3, 'return'); assert.equal(back.length, 7); assert.equal(back[6], 220); assert.equal(back[2], back[4]);
});
test('reject out of range, invalid modes, counts and non-finite values without clamping', () => {
  for (const baseHz of [0, 39, 2001, NaN, Infinity]) assert.throws(() => buildSchedule({ ...config, baseHz }));
  assert.throws(() => frequency(1800, 3, 2)); assert.throws(() => cascade(40, 2, 'descending'));
  for (const n of [0, 1.5, 9]) assert.throws(() => cascade(220, n, 'ascending'));
  assert.throws(() => buildSchedule({ ...config, ratioId: 'cascade-13-12', mode: 'simultaneous', direction: 'return', increments: 8 }));
  assert.equal(voiceGain(9), 1 / 9); assert.equal(masterGain(20), 0.05);
});
test('schedule accounts for exact total duration and voice normalization', () => {
  const s = buildSchedule({ ...config, ratioId: 'cascade-13-12', direction: 'return' });
  assert.equal(s.steps.length, 7); assert.equal(s.steps.at(-1)!.offsetSeconds + s.steps.at(-1)!.durationSeconds, 300);
  assert.deepEqual(buildSchedule({ ...config, mode: 'simultaneous' }).steps[0].frequencies, [220, 330]);
});
