import { adaptHarmonicConfig, type SourceConfigSnapshot } from './adapter';
import { validateConstellation, type HarmonicConstellationV1 } from './constellations';
import { RATIOS, type HarmonicConfig } from './math';
import { validateRatio, type HarmonicRatioV1 } from './ratios';

const APPLY_IDS = ['root', 'fifth', 'fourth', 'major-third', 'minor-third'] as const;
export type ApplyRatioId = typeof APPLY_IDS[number];
export type HarmonicApplyResult =
  | { readonly status: 'supported'; readonly config: HarmonicConfig; readonly constellation: HarmonicConstellationV1; readonly explanation: string }
  | { readonly status: 'unsupported' | 'invalid'; readonly reason: string };

/** Exact catalog operands only. No rounding, equivalent-fraction normalization or octave folding. */
export function applyRatioId(ratio: HarmonicRatioV1): ApplyRatioId | null {
  return APPLY_IDS.find(id => RATIOS[id].p === ratio.numerator && RATIOS[id].q === ratio.denominator) ?? null;
}
function copyConfig(source: SourceConfigSnapshot): HarmonicConfig {
  return { ...source, ...(source.progression ? { progression: [...source.progression] } : {}) } as HarmonicConfig;
}
function unsupported(reason: string): HarmonicApplyResult { return Object.freeze({ status: 'unsupported', reason }); }

/**
 * Strict inverse bridge, NOT a constellation playback compiler.
 * Context supplies every session field absent from the constellation. It must be
 * valid V1 and non-cascade. Only the default pair root + named interval may change
 * ratioId. An explicit progression can only roundtrip unchanged, never be replaced.
 * The supplied constellation must exactly match the forward adapter's complete
 * canonical output, not merely its signature. Custom names/IDs, member definitions,
 * operand scalings, octave types, extra voices, changed seeds/modes are rejected.
 * Both inputs are captured by the existing validators before awaiting either hash.
 */
export async function inverseHarmonicConfig(value: unknown, context: unknown): Promise<HarmonicApplyResult> {
  const [current, constellation] = await Promise.all([
    adaptHarmonicConfig(context),
    validateConstellation(value).then(result => ({ valid: true as const, result }), () => ({ valid: false as const })),
  ]);
  if (current.status !== 'supported') return current;
  if (!constellation.valid) return Object.freeze({ status: 'invalid', reason: 'Constelación inválida: revisa versión, miembros, frecuencias, orden y firma.' });
  const supplied = constellation.result;
  const config = copyConfig(current.sourceConfig);
  if (config.progression === undefined) {
    if (supplied.members.length !== 2 || supplied.members[0].relationshipType !== 'root') return unsupported('Solo se admite el par V1 de semilla e intervalo; no constelaciones arbitrarias.');
    const member = supplied.members[1];
    const ratioId = member.relationshipType === 'root' ? 'root' : member.relationshipType === 'ratio' ? applyRatioId(member.ratio) : null;
    if (!ratioId) return unsupported('Relación de exploración solamente: no es un intervalo autorizado de V1.');
    config.ratioId = ratioId;
  }
  const expected = await adaptHarmonicConfig(config);
  if (expected.status !== 'supported') return expected;
  if (JSON.stringify(supplied) !== JSON.stringify(expected.constellation)) return unsupported('La constelación no coincide exactamente con el contexto V1. No se cambian semilla, modo, progresión, miembros ni metadatos personalizados.');
  if (config.progression) Object.freeze(config.progression);
  return Object.freeze({ status: 'supported', config: Object.freeze(config), constellation: expected.constellation,
    explanation: 'Intervalo exacto V1. Se conservan semilla, modo, duración, volumen, onda y demás campos. Aplicar no inicia audio.' });
}

/** Selection preview: returns a proposal only. Application must validate again against current context. */
export async function proposeRelationshipApply(value: unknown, context: unknown): Promise<HarmonicApplyResult> {
  let ratio: HarmonicRatioV1;
  try { ratio = validateRatio(value); } catch { return Object.freeze({ status: 'invalid', reason: 'Relación inválida.' }); }
  const current = await adaptHarmonicConfig(context);
  if (current.status !== 'supported') return current;
  const ratioId = applyRatioId(ratio);
  if (!ratioId) return unsupported('Solo exploración: esta relación no pertenece a los intervalos autorizados para aplicar.');
  if (current.sourceConfig.progression !== undefined) return unsupported('Una progresión explícita solo puede conservarse mediante roundtrip; no se sustituye por un intervalo.');
  const proposed = await adaptHarmonicConfig({ ...copyConfig(current.sourceConfig), ratioId });
  if (proposed.status !== 'supported') return proposed;
  return inverseHarmonicConfig(proposed.constellation, current.sourceConfig);
}
