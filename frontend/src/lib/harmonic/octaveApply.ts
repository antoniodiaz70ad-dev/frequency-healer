import { buildSchedule, type HarmonicConfig } from './math';
import { octaveFrequency } from './octaves';

export type OctaveApplyResult =
  | { readonly status: 'supported'; readonly config: HarmonicConfig }
  | { readonly status: 'invalid'; readonly reason: string };

/** Pure seed proposal. No constellation conversion, effects, defaults or correction.
 * Validate both complete V1 configurations, including cascades and progressions.
 * Call again with the current form at explicit Apply; selection never mutates it.
 */
export function proposeOctaveApply(offset: unknown, context: unknown): OctaveApplyResult {
  try {
    const allowed = ['baseHz','ratioId','increments','direction','mode','durationSeconds','uiVolume','waveform','progression'];
    if (!context || typeof context !== 'object' || Array.isArray(context) || Object.keys(context).some(key => !allowed.includes(key))) throw new Error('Configuración inválida o campos desconocidos.');
    const raw = context as Record<string, unknown>;
    if (raw.progression !== undefined && !Array.isArray(raw.progression)) throw new Error('Progresión inválida.');
    const current = { ...raw, ...(Array.isArray(raw.progression) ? { progression: Array.from(raw.progression) } : {}) } as unknown as HarmonicConfig;
    buildSchedule(current);
    if (typeof offset !== 'number') throw new Error('Desplazamiento de octava inválido.');
    const config = { ...current, baseHz: octaveFrequency(current.baseHz, offset) };
    buildSchedule(config);
    if (config.progression) Object.freeze(config.progression);
    return Object.freeze({ status: 'supported', config: Object.freeze(config) });
  } catch (error) {
    return Object.freeze({ status: 'invalid', reason: error instanceof Error ? error.message : 'Configuración inválida.' });
  }
}
