import { buildSchedule, type HarmonicConfig, type RatioId } from '../harmonic/math';
import type { VoiceGoal, VoiceSessionProposalV1 } from './types';
import { dictionaries } from './i18n';
import { validateIntent } from './validation';
import { selectSeed, type SeedEvidenceInputV1 } from './seedSelection';
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
function assemble(value:unknown,edits:ProposalEdits,version:'voice-rules-v1'|'voice-rules-v2',evidence:SeedEvidenceInputV1={}):VoiceSessionProposalV1 {
  const intent = validateIntent(value), rule = RULES[intent.goal];
  const experimental = intent.goal === 'creative_exploration' || intent.intensity === 'experimental';
  const progression = intent.intensity === 'gentle' && rule.progression.length > 3 ? [rule.progression[0], 'root' as const] : rule.progression;
  const draft: HarmonicConfig = {
    baseHz: 144, uiVolume: intent.intensity === 'gentle' || intent.goal === 'sleep_preparation' ? 15 : 20,
    mode: 'sequence', ratioId: experimental ? 'cascade-13-12' : progression[0] === 'root' ? 'fifth' : progression[0],
    increments: 3, direction: 'return', waveform: 'sine', durationSeconds: intent.durationMinutes * 60,
    ...edits,
  };
  if (!experimental && edits.ratioId === undefined) draft.progression = progression;
  const effective=experimental?Array.from({length:draft.increments*2+1},(_,i)=>`(13/12)^${i<=draft.increments?i:2*draft.increments-i}`):(draft.progression??['root',draft.ratioId]);
  const seedSelection=version==='voice-rules-v2'?selectSeed(draft,effective,evidence,edits.baseHz):undefined;
  const harmonicConfig={...draft,baseHz:seedSelection?.selectedSeedHz??144};
  const schedule = buildSchedule(harmonicConfig);
  const proposalIdentity=version==='voice-rules-v2'?{ruleVersion:version,seedRegistryVersion:seedSelection!.seedRegistryVersion,seedSelectionVersion:seedSelection!.seedSelectionVersion,intent,effectiveProgression:[...effective],selectedSeed:harmonicConfig.baseHz,finalHarmonicConfig:structuredClone(harmonicConfig)} as const:undefined;
  const canonical = JSON.stringify([version,proposalIdentity??intent,harmonicConfig]);
  let hash = 2166136261; for (const c of canonical) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return { schemaVersion: 1, proposalId: `voice-${version==='voice-rules-v2'?'v2':'v1'}-${(hash >>> 0).toString(16)}`, ruleId: `voice-${intent.goal}-${intent.intensity}`, ruleVersion: version,
    source: Object.keys(edits).length ? 'user-customized' : 'local-rule', intent, harmonicConfig, schedule,
    rationale: [edits.ratioId ? 'Relación elegida por ti; revisa los tonos y la secuencia resultante.' : dictionaries.es.rationale[intent.goal], ...(intent.intensity === 'gentle' ? ['Intensidad suave: recorrido reducido y volumen inicial bajo.'] : []), 'Decisión de diseño sonoro, sin atribuir efectos a una frecuencia.'],...(seedSelection?{seedSelection,proposalIdentity}:{}),
    warnings: ['Comienza con un volumen cómodo. No uses la sesión al conducir o manejar maquinaria.', 'La sesión se detiene si ocultas la pestaña; no se reanuda automáticamente.'],
    requiresExplicitExperimentalConsent: harmonicConfig.ratioId === 'cascade-13-12' || intent.intensity === 'experimental' };
}
export function buildLegacyProposal(value:unknown,edits:ProposalEdits={}):VoiceSessionProposalV1{return assemble(value,edits,'voice-rules-v1');}
export function buildProposal(value: unknown, edits: ProposalEdits = {}, evidence:SeedEvidenceInputV1 = {}): VoiceSessionProposalV1 { return assemble(value,edits,'voice-rules-v2',evidence); }
export function validateProposal(proposal: VoiceSessionProposalV1) {
  validateIntent(proposal.intent);
  if (proposal.schemaVersion !== 1 || !['voice-rules-v1','voice-rules-v2'].includes(proposal.ruleVersion) || proposal.harmonicConfig.durationSeconds !== proposal.intent.durationMinutes * 60) throw new Error('Propuesta inválida. Genera una nueva.');
  const schedule = buildSchedule(proposal.harmonicConfig);
  if (JSON.stringify(schedule) !== JSON.stringify(proposal.schedule)) throw new Error('Los tonos no coinciden con las reglas locales.');
  if(proposal.ruleVersion==='voice-rules-v2'){
    if(!proposal.seedSelection||!proposal.proposalIdentity)throw new Error('Falta la procedencia de selección de base.');
    const evidence={personal:Object.fromEntries(proposal.seedSelection.candidates.filter(c=>c.personalEvidence).map(c=>[c.seedHz,c.personalEvidence!])),discovery:Object.fromEntries(proposal.seedSelection.candidates.filter(c=>c.discoveryEvidence).map(c=>[c.seedHz,c.discoveryEvidence!])),fingerprint:proposal.seedSelection.evidenceFingerprint};
    const rebuiltSelection=selectSeed({...proposal.harmonicConfig,baseHz:144},proposal.proposalIdentity.effectiveProgression,evidence,proposal.seedSelection.source==='user-customized'?proposal.harmonicConfig.baseHz:undefined);
    const identity={ruleVersion:'voice-rules-v2' as const,seedRegistryVersion:rebuiltSelection.seedRegistryVersion,seedSelectionVersion:rebuiltSelection.seedSelectionVersion,intent:proposal.intent,effectiveProgression:[...proposal.proposalIdentity.effectiveProgression],selectedSeed:proposal.harmonicConfig.baseHz,finalHarmonicConfig:structuredClone(proposal.harmonicConfig)};
    const configKey=(c:HarmonicConfig)=>JSON.stringify([c.baseHz,c.ratioId,c.increments,c.direction,c.mode,c.durationSeconds,c.uiVolume,c.waveform,c.progression??null]);
    const sameIdentity=identity.ruleVersion===proposal.proposalIdentity.ruleVersion&&identity.seedRegistryVersion===proposal.proposalIdentity.seedRegistryVersion&&identity.seedSelectionVersion===proposal.proposalIdentity.seedSelectionVersion&&JSON.stringify(identity.intent)===JSON.stringify(proposal.proposalIdentity.intent)&&JSON.stringify(identity.effectiveProgression)===JSON.stringify(proposal.proposalIdentity.effectiveProgression)&&identity.selectedSeed===proposal.proposalIdentity.selectedSeed&&configKey(identity.finalHarmonicConfig)===configKey(proposal.proposalIdentity.finalHarmonicConfig);
    if(JSON.stringify(rebuiltSelection)!==JSON.stringify(proposal.seedSelection)||!sameIdentity)throw new Error('La propuesta o su procedencia no coincide con la política local.');
  }
  return { ...proposal, schedule, requiresExplicitExperimentalConsent: proposal.harmonicConfig.ratioId === 'cascade-13-12' || proposal.intent.intensity === 'experimental' };
}
