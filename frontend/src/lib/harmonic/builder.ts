import { adaptHarmonicConfig } from './adapter';
import { applyRatioId } from './apply';
import { validateConstellation, type HarmonicRelationshipV1 } from './constellations';
import type { HarmonicConfig, RatioId } from './math';

export function moveBuilderMember(members: readonly HarmonicRelationshipV1[], from: number, to: number) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= members.length || to >= members.length) throw new Error('Posición de miembro inválida.');
  const next = [...members]; next.splice(to, 0, next.splice(from, 1)[0]); return next;
}
export type BuilderPlayability = { status: 'compatible' | 'partial' | 'builder-only'; reason: string };
/** Structural audit only. No playback config is returned, applied or persisted.
 * Context supplies existing V1 timing/gain fields solely for adapter validation.
 * Member IDs/names are display identity; mathematical signature AND exact ordered
 * frequencies must match. Octave-typed members are deliberately not translated.
 */
export async function assessBuilderPlayability(value: unknown, context: HarmonicConfig): Promise<BuilderPlayability> {
  const source = { ...context, ...(context.progression ? { progression: [...context.progression] } : {}) };
  const constellation = await validateConstellation(value);
  const ids = constellation.members.map(member => member.relationshipType === 'root' ? 'root' : member.relationshipType === 'ratio' ? applyRatioId(member.ratio) : null);
  const known = ids.filter(id => id !== null).length;
  if (known === ids.length) {
    const adapted = await adaptHarmonicConfig({ ...source, baseHz: constellation.seedFrequencyHz, mode: constellation.playbackMode, ratioId: 'root', progression: ids as RatioId[] });
    if (adapted.status === 'supported' && adapted.constellation.signature === constellation.signature && adapted.constellation.members.every((member, index) => member.frequencyHz === constellation.members[index].frequencyHz)) {
      return { status: 'compatible', reason: 'Estructura musical representable exactamente por una progresión V1 en el contexto actual. No es Apply ni autorización de reproducción; nombres e IDs no se transfieren al motor.' };
    }
  }
  return known ? { status: 'partial', reason: 'Hay miembros con relaciones V1, pero la estructura completa no se certifica con el adaptador y el contexto actuales. No se aproxima ni se reproduce.' }
    : { status: 'builder-only', reason: 'Solo Builder. 5:3, 2:1 y miembros de tipo octava no se traducen a reproducción V1 en esta fase.' };
}
