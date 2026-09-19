import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exploreHarmonics } from '../src/lib/harmonic/explorer';
import { ratioFrequency } from '../src/lib/harmonic/ratios';
import { octaveFrequency } from '../src/lib/harmonic/octaves';

test('explorer: exact 432 Hz octaves and read-only ratio set', () => {
  const result = exploreHarmonics(432);
  assert.deepEqual(result.octaves.map(o => o.frequencyHz), [54, 108, 216, 432, 864, 1728]);
  assert.deepEqual(result.octaves.map(o => o.offset), [-3, -2, -1, 0, 1, 2]);
  assert.deepEqual(result.ratios.map(r => r.label), ['1:1', '5:4', '4:3', '3:2', '5:3', '2:1']);
  assert.deepEqual(result.ratios.map(r => r.frequencyHz), [432, 540, 576, 648, 720, 864]);
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.octaves)); assert.ok(Object.isFrozen(result.ratios));
  for (const row of [...result.octaves, ...result.ratios]) assert.ok(Object.isFrozen(row));
});

test('explorer: boundary seeds omit out-of-range values and preserve unrounded results', () => {
  assert.deepEqual(exploreHarmonics(40).octaves.map(o => o.frequencyHz), [40, 80, 160, 320, 640, 1280]);
  assert.deepEqual(exploreHarmonics(2000).octaves.map(o => o.frequencyHz), [62.5, 125, 250, 500, 1000, 2000]);
  assert.deepEqual(exploreHarmonics(2000).ratios.map(r => r.frequencyHz), [2000]);
  for (const seed of [40, 40.000000001, 432.123456789, 1000, 1000.000000001, 1999.999999, 2000]) {
    const result = exploreHarmonics(seed);
    assert.deepEqual(result, exploreHarmonics(seed));
    for (const o of result.octaves) { assert.equal(o.frequencyHz, octaveFrequency(seed, o.offset)); assert.ok(o.frequencyHz >= 40 && o.frequencyHz <= 2000); }
    for (const r of result.ratios) { assert.equal(r.frequencyHz, ratioFrequency(seed, { numerator: r.numerator, denominator: r.denominator })); assert.ok(r.frequencyHz >= 40 && r.frequencyHz <= 2000); }
    for (let offset = -10; offset <= 10; offset++) {
      let hz: number | undefined;
      try { hz = octaveFrequency(seed, offset); } catch { /* Expected outside the valid range. */ }
      if (hz === undefined) assert.ok(!result.octaves.some(o => o.offset === offset));
      else assert.ok(result.octaves.some(o => o.offset === offset && o.frequencyHz === hz));
    }
  }
});

test('explorer: invalid seeds fail without clamping or invented zero values', () => {
  for (const seed of [0, 39.99999, 2000.00001, NaN, Infinity, -Infinity]) assert.throws(() => exploreHarmonics(seed));
});
