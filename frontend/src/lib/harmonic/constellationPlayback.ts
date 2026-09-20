import { validateConstellation, type HarmonicConstellationV1 } from './constellations';
import { applyRatioId } from './apply';
import { adaptHarmonicConfig } from './adapter';
import { buildSchedule, type HarmonicConfig, type HarmonicSchedule, type RatioId } from './math';

export interface ConstellationPlaybackPlan {
  readonly constellation: HarmonicConstellationV1;
  readonly config: HarmonicConfig;
  readonly schedule: HarmonicSchedule;
}
/** Exact bridge into the existing V1 progression scheduler, never an audio engine.
 * IDs/names remain in the source snapshot. No member is added, dropped, folded or
 * deduplicated. Only exact catalog operands are supported, preserving IEEE values.
 */
export async function planConstellationPlayback(value: unknown, context: HarmonicConfig): Promise<ConstellationPlaybackPlan> {
  const timing = { durationSeconds: context.durationSeconds, uiVolume: context.uiVolume, waveform: context.waveform };
  const constellation = await validateConstellation(value);
  if (constellation.members.length > 9) throw new Error('V1 admite como máximo 9 miembros por progresión. No se omiten miembros.');
  const progression: RatioId[] = constellation.members.map(member => {
    const id = member.relationshipType === 'root' ? 'root' : member.relationshipType === 'ratio' ? applyRatioId(member.ratio) : null;
    if (!id) throw new Error(`Miembro ${member.id}: relación no representable exactamente por V1. Octavas, 5:3, 2:1 y ratios fuera del catálogo no se reproducen ni se aproximan.`);
    return id;
  });
  const config: HarmonicConfig = { baseHz: constellation.seedFrequencyHz, ratioId: 'root', increments: 1, direction: 'ascending', mode: constellation.playbackMode, ...timing, progression };
  const schedule = buildSchedule(config);
  const adapted = await adaptHarmonicConfig(config);
  const frequencies = schedule.steps.flatMap(step => step.frequencies);
  if (adapted.status !== 'supported' || adapted.constellation.signature !== constellation.signature || frequencies.length !== constellation.members.length || frequencies.some((hz, i) => hz !== constellation.members[i].frequencyHz)) throw new Error('La representación V1 no conserva exactamente la constelación.');
  Object.freeze(progression); Object.freeze(config);
  for (const step of schedule.steps) { Object.freeze(step.frequencies); Object.freeze(step.ratios); Object.freeze(step); }
  Object.freeze(schedule.steps); Object.freeze(schedule);
  return Object.freeze({ constellation, config, schedule });
}
