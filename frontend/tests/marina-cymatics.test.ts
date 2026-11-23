import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultComposition, starterCompositions } from '../src/lib/marina/composer';
import { composerSpectrum, computeComposerCymatics } from '../src/lib/marina/composerCymatics';
import { computeModalField, defaultCymaticsConfig } from '../src/lib/cymatics/physics';

const near = (actual: number, expected: number, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1e-10, Math.abs(expected)), `${actual} != ${expected}`);

test('cymatics spectrum reconstructs the audible AM waveform including sideband phase and folded frequencies', () => {
  for (const [carrierHz, rateHz, depth] of [[200, 7.5, .35], [200, .32789, 1], [20, 40, .7], [20, 20, .5]]) {
    const recipe = defaultComposition(); Object.assign(recipe.layers[0], { carrierHz, rateHz, depth });
    const spectrum = composerSpectrum(recipe, 'left');
    for (const t of [.00013, .001, .0057, .123, 1.755]) {
      const actual = spectrum.reduce((sum, c) => sum + c.real * Math.cos(2 * Math.PI * c.hz * t) - c.imaginary * Math.sin(2 * Math.PI * c.hz * t), 0);
      const expected = .6 * Math.sin(2 * Math.PI * carrierHz * t) * (1 - depth / 2 + depth / 2 * Math.sin(2 * Math.PI * rateHz * t));
      assert.ok(Math.abs(actual - expected) < 1e-10, 'spectral reconstruction matches the AM waveform, including near zero crossings');
    }
    assert.ok(!spectrum.some(c => c.hz === rateHz && carrierHz !== rateHz && carrierHz !== 2 * rateHz));
  }
});

test('binaural channels are independent and disabled/zero-level layers cannot enter the image', () => {
  const recipe = starterCompositions()[0];
  assert.deepEqual(composerSpectrum(recipe, 'left').map(c => c.hz), [200]);
  assert.deepEqual(composerSpectrum(recipe, 'right').map(c => c.hz), [207.8]);
  recipe.layers[1].enabled = true; recipe.layers[1].level = 0;
  assert.deepEqual(composerSpectrum(recipe, 'right').map(c => c.hz), [207.8]);
  recipe.layers[0].enabled = false;
  assert.equal(computeComposerCymatics(recipe, 'left', defaultCymaticsConfig()).field, null);
});

test('mixture RMS agrees with independent frequency energy; coincident tones combine coherently with audio normalization', () => {
  const recipe = starterCompositions()[1], config = defaultCymaticsConfig(), size = 8;
  const result = computeComposerCymatics(recipe, 'left', config, size);
  assert.ok(result.field);
  const responses = recipe.layers.map(layer => computeModalField(config, layer.carrierHz, size));
  const sumLevels = recipe.layers.reduce((sum, layer) => sum + layer.level, 0);
  for (let i = 0; i < size * size; i++) {
    const energy = responses.reduce((sum, field, layer) => sum + (field.values[i] * recipe.layers[layer].level / sumLevels) ** 2 / 2, 0);
    near(result.field.values[i], Math.sqrt(energy));
  }
  recipe.layers.forEach(layer => { layer.carrierHz = 200; layer.level = .5; });
  const components = composerSpectrum(recipe, 'left');
  assert.equal(components.length, 1); near(components[0].imaginary, -1);
  const coherent = computeComposerCymatics(recipe, 'left', config, size).field!;
  const reference = computeModalField(config, 200, size);
  near(coherent.rmsAmplitude, reference.rmsAmplitude / Math.sqrt(2));
  recipe.layers.forEach(layer => { layer.level = .1; });
  near(computeComposerCymatics(recipe, 'left', config, size).field!.rmsAmplitude, coherent.rmsAmplitude * .3);
});

test('unsupported components suppress the whole figure instead of silently misrepresenting the mix', () => {
  const recipe = defaultComposition(), config = defaultCymaticsConfig();
  recipe.layers[0].carrierHz = 1999;
  assert.equal(computeComposerCymatics(recipe, 'left', config).field, null);
  Object.assign(recipe.layers[0], { carrierHz: 20, rateHz: 20 });
  const dc = computeComposerCymatics(recipe, 'left', config);
  assert.equal(dc.components[0].hz, 0); assert.equal(dc.field, null);
  Object.assign(recipe.layers[0], { carrierHz: 200, depth: 0 });
  assert.deepEqual(composerSpectrum(recipe, 'left').map(c => c.hz), [200]);
  recipe.layers[0].carrierHz = NaN;
  assert.throws(() => computeComposerCymatics(recipe, 'left', config));
});
