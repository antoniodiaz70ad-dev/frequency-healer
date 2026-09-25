import { buildSchedule, RATIOS, type HarmonicConfig, type HarmonicSchedule, type RatioId } from './math';
import { compileConstellation, type HarmonicConstellationV1, type HarmonicRelationshipV1 } from './constellations';

export type SourceConfigSnapshot = Readonly<Omit<HarmonicConfig, 'progression'>> & { readonly progression?: readonly RatioId[] };
export interface ScheduleSnapshot {
  readonly family: HarmonicSchedule['family'];
  readonly durationSeconds: number;
  readonly steps: readonly {
    readonly offsetSeconds: number;
    readonly durationSeconds: number;
    readonly frequencies: readonly number[];
    readonly ratios: readonly string[];
  }[];
}
export type HarmonicAdapterResult =
  | { readonly status: 'supported'; readonly sourceConfig: SourceConfigSnapshot; readonly schedule: ScheduleSnapshot; readonly constellation: HarmonicConstellationV1 }
  | { readonly status: 'unsupported'; readonly code: 'cascade-not-supported'; readonly reason: string }
  | { readonly status: 'invalid'; readonly reason: string };

/**
 * One-way, read-only data adapter. Never used as an input to playback or storage.
 * V1 remains authoritative for validation, frequency evaluation and scheduling.
 * The constellation alone does not contain timing, volume or waveform: retain
 * those losslessly in sourceConfig and the exact V1 schedule alongside it.
 * Its mathematical signature is NOT a fingerprint of the entire audio session.
 * Occurrence IDs keep repetitions and order; no seed is inserted into an explicit
 * progression. All source fields (including currently inactive controls) survive.
 * SHA-256 failures reject the Promise; they are not mislabeled invalid configs.
 */
export async function adaptHarmonicConfig(input: unknown): Promise<HarmonicAdapterResult> {
  let config: HarmonicConfig;
  let schedule: HarmonicSchedule;
  try {
    const allowed = ['baseHz', 'ratioId', 'increments', 'direction', 'mode', 'durationSeconds', 'uiVolume', 'waveform', 'progression'];
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !allowed.includes(key))) throw new Error('Configuración inválida o campos desconocidos.');
    const raw = input as Record<string, unknown>;
    if (raw.progression !== undefined && !Array.isArray(raw.progression)) throw new Error('Progresión inválida.');
    // Copy before validation/hashing; Array.from exposes holes to V1 validation.
    config = { ...raw, ...(Array.isArray(raw.progression) ? { progression: Array.from(raw.progression) } : {}) } as unknown as HarmonicConfig;
    schedule = buildSchedule(config);
  } catch (error) {
    return Object.freeze({ status: 'invalid', reason: error instanceof Error ? error.message : 'Configuración inválida.' });
  }
  if (config.ratioId === 'cascade-13-12') return Object.freeze({ status: 'unsupported', code: 'cascade-not-supported', reason: 'La cascada 13/12 no se adapta en esta fase. Su reproducción V1 sigue disponible sin cambios.' });

  const ids = config.progression ?? ['root', config.ratioId] as RatioId[];
  const members: HarmonicRelationshipV1[] = ids.map((ratioId, index) => {
    const id = `v1-${index}-${ratioId}`;
    const ratio = RATIOS[ratioId];
    return ratioId === 'root' ? { id, relationshipType: 'root' } : {
      id, relationshipType: 'ratio', ratio: { numerator: ratio.p, denominator: ratio.q, label: ratio.label },
    };
  });
  const sourceConfig: SourceConfigSnapshot = Object.freeze({ ...config, ...(config.progression ? { progression: Object.freeze([...config.progression]) } : {}) });
  const scheduleSnapshot: ScheduleSnapshot = Object.freeze({ ...schedule, steps: Object.freeze(schedule.steps.map(step => Object.freeze({
    ...step, frequencies: Object.freeze([...step.frequencies]), ratios: Object.freeze([...step.ratios]),
  }))) });
  const constellation = await compileConstellation({ seedFrequencyHz: config.baseHz, playbackMode: config.mode, members });
  return Object.freeze({ status: 'supported', sourceConfig, schedule: scheduleSnapshot, constellation });
}
