import { recommendationRule, type HarmonicRecommendationRuleV1 } from './rationale';
import { interpretCanonicalIntent, guidanceBoundary, CANONICAL_INTENT_TAXONOMY_VERSION } from '../voice/intentParser';
import { buildProposal } from '../voice/rules';
import { validateIntent, text } from '../voice/validation';
import { validateRecord } from '../voice/storage';
import { n1Summary, type N1Metric } from '../voice/analytics';
import type { ParsedIntentionV1, VoiceSessionProposalV1 } from '../voice/types';
import { dictionaries } from '../voice/i18n';
import { discoverySeedEvidence, evidenceFingerprint, personalSeedEvidence } from '../voice/seedSelection';
import type { ProtocolDiscoveryPlanV1 } from '../discovery/model';

export const GUIDED_TAXONOMY_VERSION = CANONICAL_INTENT_TAXONOMY_VERSION;
export { guidanceBoundary };
export interface GuidedInterpretationV1 { schemaVersion: 1; taxonomyVersion: typeof GUIDED_TAXONOMY_VERSION; rawText: string; intent: ParsedIntentionV1; explanation: string }
export function interpretGuidedIntent(raw: string): GuidedInterpretationV1 {
  return interpretCanonicalIntent(raw);
}
export interface PersonalEvidenceV1 { available: boolean; comparableSessions: number | null; evidenceLevel: 'none'|'insufficient'|'preliminary'|'descriptive'; metrics: N1Metric[]; explanation: string }
function configKey(p: VoiceSessionProposalV1) {
  const c=p.harmonicConfig;
  return JSON.stringify([p.ruleVersion,p.ruleId,p.intent.goal,p.intent.intensity,p.intent.desiredStates,c.baseHz,c.ratioId,c.increments,c.direction,c.mode,c.durationSeconds,c.uiVolume,c.waveform,c.progression??null]);
}
export function personalEvidence(proposal: VoiceSessionProposalV1, values: readonly unknown[] | null): PersonalEvidenceV1 {
  const explanation='Solo historial de voz validado, finalizado y con duración real completa; misma regla, objetivo, estados, intensidad y configuración exacta, incluido volumen y duración. Exigimos pares antes/después en las tres escalas y ausencia de comandos que puedan alterar la sesión. Los datos ausentes se excluyen, nunca se completan. No se mezclan experimentos sin objetivo estructurado.';
  if(values===null)return {available:false,comparableSessions:null,evidenceLevel:'none',metrics:[],explanation:'Historial no disponible o inválido; no equivale a N=0. No se modifica. '+explanation};
  const records=values.map(validateRecord);if(new Set(records.map(r=>r.id)).size!==records.length)throw new Error('Historial con IDs duplicados.');
  const rows=records.filter(r=>r.status==='completed' && !r.markers.some(marker=>marker.kind==='command') && r.technical.actualDurationMs>=proposal.harmonicConfig.durationSeconds*1000 && configKey(r.proposal)===configKey(proposal) && (['clarity','stress','focus'] as const).every(metric=>r.before?.[metric]!==undefined&&r.after?.[metric]!==undefined));
  const n=rows.length;
  return {available:true,comparableSessions:n,evidenceLevel:n===0?'none':n<5?'insufficient':n<10?'preliminary':'descriptive',metrics:n<5?[]:n1Summary(rows).flatMap(group=>group.metrics),explanation};
}
export interface GuidedRecommendationV1 {
  schemaVersion: 1;
  interpretation: GuidedInterpretationV1;
  // This is the existing executable proposal, not a duplicate configuration model.
  proposal: VoiceSessionProposalV1;
  personalEvidence: PersonalEvidenceV1;
  explanation: string[];
  rule: HarmonicRecommendationRuleV1;
}
export function recommendGuided(interpretation: GuidedInterpretationV1, values: readonly unknown[] | null = [], volume?: number,seedContext?:{discoveryPlans?:readonly ProtocolDiscoveryPlanV1[];fingerprint?:string}): GuidedRecommendationV1 {
  if(interpretation.schemaVersion!==1||interpretation.taxonomyVersion!==GUIDED_TAXONOMY_VERSION)throw new Error('Versión de interpretación desconocida.');
  const rawText=text(interpretation.rawText),intent=validateIntent(interpretation.intent);
  const boundary=guidanceBoundary(rawText)||guidanceBoundary(intent.intention);if(boundary)throw new Error(boundary);
  const validatedRecords=values===null?null:values.map(validateRecord);
  const baseline=buildProposal(intent,volume===undefined?{}:{uiVolume:volume});
  const seedEvidence=validatedRecords===null?{fingerprint:seedContext?.fingerprint??evidenceFingerprint(null,null)}:(validatedRecords.length||seedContext?.discoveryPlans?.length)?{personal:personalSeedEvidence(intent,baseline.harmonicConfig,validatedRecords),...(seedContext?.discoveryPlans?{discovery:discoverySeedEvidence(intent,baseline.harmonicConfig,seedContext.discoveryPlans)}:{}),fingerprint:seedContext?.fingerprint??evidenceFingerprint(JSON.stringify(values),null)}:seedContext?.fingerprint?{fingerprint:seedContext.fingerprint}:{};
  const proposal=buildProposal(intent,volume===undefined?{}:{uiVolume:volume},seedEvidence);
  return {schemaVersion:1,interpretation:{...interpretation,rawText,intent},proposal,rule:recommendationRule(proposal),personalEvidence:personalEvidence(proposal,values),explanation:[`Objetivo revisado: ${dictionaries.es.goals[intent.goal]}. Regla ${proposal.ruleId} (${proposal.ruleVersion}).`,...proposal.rationale,'Una sola opción validada por las reglas actuales. Suave/profunda describen el diseño, no potencia médica. El historial no cambia la selección ni el orden de recomendaciones.','Las observaciones personales no demuestran eficacia médica ni causalidad.']};
}
/** Rebuild executable output at confirmation. Never trust a supplied schedule. */
export function validateGuidedRecommendation(value: GuidedRecommendationV1, experimentalConsent: boolean) {
  if(value.schemaVersion!==1)throw new Error('Versión de recomendación desconocida.');
  const edits=value.proposal.source==='user-customized'?{uiVolume:value.proposal.harmonicConfig.uiVolume}:{};
  const selection=value.proposal.seedSelection;
  const seedEvidence=selection?{personal:Object.fromEntries(selection.candidates.filter(c=>c.personalEvidence).map(c=>[c.seedHz,c.personalEvidence!])),discovery:Object.fromEntries(selection.candidates.filter(c=>c.discoveryEvidence).map(c=>[c.seedHz,c.discoveryEvidence!])),fingerprint:selection.evidenceFingerprint}:{};
  const rebuilt=buildProposal(value.interpretation.intent,edits,seedEvidence);
  if(JSON.stringify(recommendationRule(rebuilt))!==JSON.stringify(value.rule))throw new Error('La explicación o la regla cambió. Genera otra propuesta.');
  if(JSON.stringify(rebuilt)!==JSON.stringify(value.proposal))throw new Error('La propuesta no coincide con la regla local. Genera otra.');
  if(rebuilt.requiresExplicitExperimentalConsent&&!experimentalConsent)throw new Error('La cascada experimental requiere consentimiento adicional.');
  return rebuilt.harmonicConfig;
}
