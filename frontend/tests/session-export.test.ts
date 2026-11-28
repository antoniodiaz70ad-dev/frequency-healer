import test from 'node:test';
import assert from 'node:assert/strict';
import { starterCompositions, compositionMix } from '../src/lib/marina/composer';
import { defaultCrystalPreparation, crystalTimeline } from '../src/lib/crystals/model';
import { DEFAULT_MARINA_CONFIG, marinaPhases } from '../src/lib/marina/model';
import { composerScore, crystalScore, marinaScore, exportFormat, type ExportScore } from '../src/lib/sessionExport/score';
import { renderPcmChunk, mixDivisor, wavHeader, type VoicePcm } from '../src/lib/sessionExport/pcm';
const voice = { enabled: true, source: 'arthur' as const, volume: .7 };

test('export adapters retain complete recipes and crystal score, with silent tail and exact available Arthur cues', () => {
  const recipe = starterCompositions()[1], before = JSON.stringify(recipe), score = composerScore(recipe, .15);
  assert.deepEqual(score.configuration, recipe); assert.equal(score.seconds, 480);
  assert.deepEqual(score.steps[0].tones.map(t => t.gain), compositionMix(recipe).map(l => l.gain));
  assert.equal(JSON.stringify(recipe), before);
  const p = { ...defaultCrystalPreparation(), crystal: 'Cuarzo de prueba', intention: 'Estudiar', duration: 10 as const };
  const crystal = crystalScore(p, .12, voice);
  assert.equal(crystal.steps.reduce((sum, s) => sum + s.seconds, 0), 600);
  assert.equal(crystal.steps.at(-1)?.tones.length, 0);
  assert.deepEqual(crystal.voice.cues.map(c => c.atMs), [0, 120000, 180000, 420000, 540000]);
  assert.deepEqual(crystal.steps.map(s => s.tones.map(t => [t.hz, t.gain])), crystalTimeline(p).map(s => s.tones.map(t => [t.hz, t.level])));
  assert.equal(crystalScore({ ...p, exposure: 'coils' }, .12, voice).voice.cues.length, 0);
});
test('Marina preserves each phase, carrier, narration coverage, silence and explicit exclusions', () => {
  const score = marinaScore(DEFAULT_MARINA_CONFIG, 'classic24', 24, true, .15, voice);
  assert.equal(score.seconds, 1440); assert.equal(score.voice.phases, 6);
  assert.deepEqual(score.voice.cues.map(c => c.key), ['marina-zero', 'marina-emotion', 'marina-blueprint', 'marina-intensify']);
  assert.deepEqual(score.steps.map(s => s.seconds), marinaPhases('classic24').map(p => p.seconds));
  assert.equal(score.steps.at(-1)?.tones.length, 0);
  assert.ok(marinaScore(DEFAULT_MARINA_CONFIG, 'classic24', 24, false, .15, voice).steps.every(s => !s.tones.length));
  assert.throws(() => marinaScore(DEFAULT_MARINA_CONFIG, 'classic24', 24, true, .15, { ...voice, source: 'device' }), /voz del dispositivo/);
  assert.throws(() => marinaScore(DEFAULT_MARINA_CONFIG, 'creation12', 12, true, .15, voice, true), /grabación personal/);
  assert.equal(marinaScore(DEFAULT_MARINA_CONFIG, 'creation12', 12, true, .15, voice).voice.cues.length, 0);
});
test('WAV header, duration, stereo frequencies and chunk continuity are deterministic', () => {
  const score = composerScore(starterCompositions()[2], .15), { sampleRate, frames, bytes } = exportFormat(score);
  const header = new DataView(wavHeader(frames, sampleRate));
  assert.equal(sampleRate, 22050); assert.equal(header.getUint16(22, true), 2);
  assert.equal(header.getUint32(40, true), frames * 4); assert.equal(bytes, 44 + frames * 4);
  const first = sampleRate * 5, count = 500;
  const pcm = new DataView(renderPcmChunk(score, sampleRate, first, count, [], 1));
  const gain = .15 * .6;
  for (let i = 0; i < count; i++) {
    const t: number = (first + i) / sampleRate;
    assert.equal(pcm.getInt16(i * 4, true), (Math.round(Math.sin(2 * Math.PI * 220 * t) * gain * 32767) || 0));
    assert.equal(pcm.getInt16(i * 4 + 2, true), (Math.round(Math.sin(2 * Math.PI * 235 * t) * gain * 32767) || 0));
  }
  const full = new Uint8Array(renderPcmChunk(score, sampleRate, first, count * 2, [], 1));
  const second = new Uint8Array(renderPcmChunk(score, sampleRate, first + count, count, [], 1));
  assert.deepEqual(full.slice(count * 4), second);
});
test('voice occurs only at the cue, uses fade and fixed headroom without changing channel balance', () => {
  const score: ExportScore = { ...composerScore(starterCompositions()[2], .6), steps: [] };
  score.voice.volume = 1;
  const voices: VoicePcm[] = [{ key: 'test', at: 1, seconds: 1, sampleRate: 1000, channels: [new Float32Array(1000).fill(1.2)] }];
  const divisor = mixDivisor(score, voices);
  assert.ok(Math.abs(divisor - 1.2) < .000001);
  assert.ok(new Uint8Array(renderPcmChunk(score, 1000, 0, 1000, voices, divisor)).every(v => v === 0));
  const pcm = new DataView(renderPcmChunk(score, 1000, 1000, 1000, voices, divisor));
  assert.equal(pcm.getInt16(0, true), 0); assert.equal(pcm.getInt16(200, true), 32767);
  for (let i = 0; i < 1000; i++) assert.equal(pcm.getInt16(i * 4, true), pcm.getInt16(i * 4 + 2, true));
});
test('pulse follows the live envelope; file limits reject rather than truncate', () => {
  const recipe = starterCompositions()[0]; recipe.layers[0].mode = 'pulse'; recipe.layers[0].depth = .35;
  const score = composerScore(recipe, .15), sr = 22050, first = sr * 5;
  const pcm = new DataView(renderPcmChunk(score, sr, first, 500, [], 1));
  for (let i = 0; i < 500; i++) {
    const t = (first + i) / sr, expected = Math.sin(2 * Math.PI * 200 * t) * (1 - .35 / 2 + .35 / 2 * Math.sin(2 * Math.PI * 7.8 * t)) * .15 * .5;
    assert.equal(pcm.getInt16(i * 4, true), (Math.round(expected * 32767) || 0));
  }
  score.seconds = 240 * 60; assert.throws(() => exportFormat(score), /256 MiB/);
  score.seconds = 60; score.steps[0].tones[0].hz = 23000; assert.throws(() => exportFormat(score), /frecuencia/);
  score.steps[0].tones[0].hz = 15000; assert.equal(exportFormat(score).sampleRate, 44100);
  assert.equal(exportFormat(marinaScore(DEFAULT_MARINA_CONFIG, 'classic24', 24, true, .15, voice)).sampleRate, 44100);
});
