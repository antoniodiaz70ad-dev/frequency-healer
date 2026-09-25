import { frequency } from './math';

/**
 * f = seed × 2^offset. The offset is an explicit safe integer, not an octave fold.
 * Existing math.frequency validates both the seed and result against its bounds.
 * No UI formatting, clamping, AudioContext, state or storage is involved.
 */
export function octaveFrequency(seedFrequencyHz: number, octaveOffset: number): number {
  frequency(seedFrequencyHz, 1, 1);
  if (!Number.isSafeInteger(octaveOffset)) throw new Error('Desplazamiento de octava inválido: usa un entero seguro.');
  return frequency(seedFrequencyHz, 2 ** octaveOffset, 1);
}
