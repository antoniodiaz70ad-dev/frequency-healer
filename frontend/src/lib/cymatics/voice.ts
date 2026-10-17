import type { PitchResult } from './pitch';

export interface VoiceReading extends PitchResult { measuredAt: number; }
/** Do not retain a previous pitch during silence, noise or uncertain frames. */
export function voiceReading(result: PitchResult | null, measuredAt: number): VoiceReading | null {
  if (!result || !Number.isFinite(result.frequencyHz) || result.frequencyHz < 80 || result.frequencyHz > 1200 || result.confidence < .85 || result.rms < .008) return null;
  return { ...result, measuredAt };
}
export function compareVoiceFrequency(hz: number, referenceHz: number) {
  if (![hz, referenceHz].every(value => Number.isFinite(value) && value > 0)) return null;
  return { differenceHz: hz - referenceHz, semitones: 12 * Math.log2(hz / referenceHz) };
}
