import { buildSchedule, type HarmonicConfig, type RatioId } from '../harmonic/math';
import type { VoiceGoal, VoiceSessionProposalV1 } from './types';
import { dictionaries } from './i18n';
import { validateIntent } from './validation';
const RULES: Record<VoiceGoal, { progression: RatioId[] }> = {
  clarity: { progression: ['major-third', 'fourth', 'fifth', 'root'] },
  focus: { progression: ['root', 'fifth', 'root', 'fifth'] },
  relaxation: { progression: ['minor-third', 'fourth', 'root'] },
  reflection: { progression: ['major-third', 'fourth', 'root'] },
  creative_exploration: { progression: [] },
  sleep_preparation: { progression: ['minor-third', 'root'] },
  custom: { progression: ['root', 'fifth', 'root'] },
};
export type ProposalEdits = Partial<Pick<HarmonicConfig, 'baseHz' | 'uiVolume' | 'mode' | 'ratioId' | 'increments' | 'direction'>>;
export function buildProposal(value: unknown, edits: ProposalEdits = {}): VoiceSessionProposalV1 {
  const intent = validateIntent(value), rule = RULES[intent.goal];
  const experimental = intent.goal === 'creative_exploration' || intent.intensity === 'experimental';
  const progression = intent.intensity === 'gentle' && rule.progression.length > 3 ? [rule.progression[0], 'root' as const] : rule.progression;
  const harmonicConfig: HarmonicConfig = {
    baseHz: 144, uiVolume: intent.intensity === 'gentle' || intent.goal === 'sleep_preparation' ? 15 : 20,
    mode: 'sequence', ratioId: experimental ? 'cascade-13-12' : progression[0] === 'root' ? 'fifth' : progression[0],
    increments: 3, direction: 'return', waveform: 'sine', durationSeconds: intent.durationMinutes * 60,
    ...edits,
  };
  if (!experimental && edits.ratioId === undefined) harmonicConfig.progression = progression;
  const schedule = buildSchedule(harmonicConfig);
  const canonical = JSON.stringify([intent, harmonicConfig]);
  let hash = 2166136261; for (const c of canonical) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return { schemaVersion: 1, proposalId: `voice-v1-${(hash >>> 0).toString(16)}`, ruleId: `voice-${intent.goal}-${intent.intensity}`, ruleVersion: 'voice-rules-v1',
    source: Object.keys(edits).length ? 'user-customized' : 'local-rule', intent, harmonicConfig, schedule,
    rationale: [edits.ratioId ? 'Relación elegida por ti; revisa los tonos y la secuencia resultante.' : dictionaries.es.rationale[intent.goal], ...(intent.intensity === 'gentle' ? ['Intensidad suave: recorrido reducido y volumen inicial bajo.'] : []), 'Decisión de diseño sonoro, sin atribuir efectos a una frecuencia.'],
    warnings: ['Comienza con un volumen cómodo. No uses la sesión al conducir o manejar maquinaria.', 'La sesión se detiene si ocultas la pestaña; no se reanuda automáticamente.'],
    requiresExplicitExperimentalConsent: harmonicConfig.ratioId === 'cascade-13-12' || intent.intensity === 'experimental' };
}
export function validateProposal(proposal: VoiceSessionProposalV1) {
  validateIntent(proposal.intent);
  if (proposal.schemaVersion !== 1 || proposal.ruleVersion !== 'voice-rules-v1' || proposal.harmonicConfig.durationSeconds !== proposal.intent.durationMinutes * 60) throw new Error('Propuesta inválida. Genera una nueva.');
  const schedule = buildSchedule(proposal.harmonicConfig);
  if (JSON.stringify(schedule) !== JSON.stringify(proposal.schedule)) throw new Error('Los tonos no coinciden con las reglas locales.');
  return { ...proposal, schedule, requiresExplicitExperimentalConsent: proposal.harmonicConfig.ratioId === 'cascade-13-12' || proposal.intent.intensity === 'experimental' };
}
