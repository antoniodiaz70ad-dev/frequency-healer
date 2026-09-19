import { frequency } from './math';
import { octaveFrequency } from './octaves';
import { ratioFrequency } from './ratios';

/** Informational relationships, deliberately separate from the V1 playback catalog. */
const EXPLORER_RATIOS = [[1, 1], [5, 4], [4, 3], [3, 2], [5, 3], [2, 1]] as const;
export interface HarmonicExplorerData {
  readonly seedFrequencyHz: number;
  readonly octaves: readonly { readonly offset: number; readonly frequencyHz: number }[];
  readonly ratios: readonly { readonly numerator: number; readonly denominator: number; readonly label: string; readonly frequencyHz: number }[];
}

/** No selection, clamping, rounding, playback, persistence or side effects. */
export function exploreHarmonics(seedFrequencyHz: number): HarmonicExplorerData {
  frequency(seedFrequencyHz, 1, 1);
  const octaves: { offset: number; frequencyHz: number }[] = [];
  // Any two valid frequencies are at most 2000/40 apart. Probe both bounds;
  // the existing pure function remains authoritative for inclusion.
  const extent = Math.ceil(Math.log2(2000 / 40));
  for (let offset = -extent; offset <= extent; offset++) {
    try { octaves.push(Object.freeze({ offset, frequencyHz: octaveFrequency(seedFrequencyHz, offset) })); }
    catch { /* Out-of-range octaves are omitted, never folded or clamped. */ }
  }
  const ratios: { numerator: number; denominator: number; label: string; frequencyHz: number }[] = [];
  for (const [numerator, denominator] of EXPLORER_RATIOS) {
    const ratio = { numerator, denominator, label: `${numerator}:${denominator}` };
    try { ratios.push(Object.freeze({ ...ratio, frequencyHz: ratioFrequency(seedFrequencyHz, ratio) })); }
    catch { /* The seed is valid; an out-of-range derived value is omitted. */ }
  }
  return Object.freeze({ seedFrequencyHz, octaves: Object.freeze(octaves), ratios: Object.freeze(ratios) });
}
