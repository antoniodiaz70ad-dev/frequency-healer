import type { PitchResult } from './pitch';

export interface VoiceReading extends PitchResult { measuredAt: number; }
/** Do not retain a previous pitch during silence, noise or uncertain frames. */
export function voiceReading(result: PitchResult | null, measuredAt: number, minRms = .008): VoiceReading | null {
  if (!result || !Number.isFinite(result.frequencyHz) || result.frequencyHz < 60 || result.frequencyHz > 1200 || result.confidence < .85 || result.rms < minRms) return null;
  return { ...result, measuredAt };
}
export function compareVoiceFrequency(hz: number, referenceHz: number) {
  if (![hz, referenceHz].every(value => Number.isFinite(value) && value > 0)) return null;
  return { differenceHz: hz - referenceHz, semitones: 12 * Math.log2(hz / referenceHz) };
}

/** Input level independent of pitch confidence, including low-volume speech. */
export function voiceInputRms(samples: Float32Array): number {
  if (!samples.length) return 0;
  let mean = 0; for (const value of samples) mean += value; mean /= samples.length;
  let sum = 0; for (const value of samples) sum += (value - mean) ** 2;
  return Math.sqrt(sum / samples.length);
}
