import { parseLocalIntent } from '../voice/intentParser';
import { buildProposal } from '../voice/rules';
import { validateIntent, text } from '../voice/validation';
import { validateRecord } from '../voice/storage';
import { n1Summary, type N1Metric } from '../voice/analytics';
import type { DesiredState, ParsedIntentionV1, VoiceGoal, VoiceSessionProposalV1 } from '../voice/types';
import { dictionaries } from '../voice/i18n';

export const GUIDED_TAXONOMY_VERSION = 'guided-mapping-v1';
// Aliases into GOALS/desired states, not a second acoustic rule table.
const ALIASES: Array<{ pattern: RegExp; goal: VoiceGoal; states: DesiredState[]; explanation: string }> = [
  {pattern:/drenad|drenaje|agotad|recuper|sin energ[ií]a|cansad|\benerg[ií]a\b|deplet|recover/,goal:'relaxation',states:['calm','grounded'],explanation:'Interpretamos esta expresión como una intención de recuperación y centrado subjetivos. No asumimos un mecanismo de drenaje energético.'},
  {pattern:/centrad|centrarme|arraig|ground|presencia/,goal:'relaxation',states:['grounded'],explanation:'Centrado y presencia se mapean a Relajación; no existe una categoría acústica separada de grounding.'},
  {pattern:/tens[oa]|estr[eé]s|regula.*emoci/,goal:'relaxation',states:['calm'],explanation:'La tensión percibida se interpreta como intención de calma, sin diagnosticar su causa.'},
  {pattern:/dispers|distrai/,goal:'focus',states:['focus'],explanation:'La dispersión se interpreta como intención de enfoque.'},
  {pattern:/medita|integraci|integrar/,goal:'reflection',states:['calm','openness'],explanation:'Meditación e integración se mapean a Reflexión y apertura.'},
];
export function guidanceBoundary(raw: string): string | null {
  return /dolor|mareo|desmayo|falta de aire|dificultad.*respir|palpitaci|curar|curaci[oó]n|tratar.*(?:enfermedad|ansiedad|depresi)|diagn[oó]st|medicaci[oó]n|suicid/i.test(raw)
    ? 'Esta guía no prescribe sesiones para síntomas o tratamientos. Busca evaluación profesional si describes síntomas; ante síntomas intensos o repentinos, atención urgente. Puedes volver a expresar una intención de exploración no clínica.' : null;
}
export interface GuidedInterpretationV1 { schemaVersion: 1; taxonomyVersion: typeof GUIDED_TAXONOMY_VERSION; rawText: string; intent: ParsedIntentionV1; explanation: string }
export function interpretGuidedIntent(raw: string): GuidedInterpretationV1 {
  const rawText=text(raw);const boundary=guidanceBoundary(rawText);if(boundary)throw new Error(boundary);
  const parsed=parseLocalIntent(rawText);const aliases=ALIASES.filter(a=>a.pattern.test(rawText.toLowerCase()));
  // Explicit legacy vocabulary wins over aliases when both are present; always review.
  const alias=parsed.goal==='custom'?aliases[0]:undefined;
  const intent=alias?validateIntent({...parsed,goal:alias.goal,desiredStates:alias.states,confidence:{...parsed.confidence,goal:aliases.length===1?1:0},requiresReview:[...new Set([...parsed.requiresReview,'goal'])]}):parsed;
  return {schemaVersion:1,taxonomyVersion:GUIDED_TAXONOMY_VERSION,rawText,intent,explanation:alias?.explanation??(aliases.length?'Hay varias pistas en el texto. Priorizamos el objetivo explícito reconocido; revisa y corrige la interpretación.':'Interpretación local revisable. Si falta información, se proponen 15 minutos y diseño suave; no se infiere eficacia.')};
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
}
export function recommendGuided(interpretation: GuidedInterpretationV1, values: readonly unknown[] | null = [], volume?: number): GuidedRecommendationV1 {
  if(interpretation.schemaVersion!==1||interpretation.taxonomyVersion!==GUIDED_TAXONOMY_VERSION)throw new Error('Versión de interpretación desconocida.');
  const rawText=text(interpretation.rawText),intent=validateIntent(interpretation.intent);
  const boundary=guidanceBoundary(rawText)||guidanceBoundary(intent.intention);if(boundary)throw new Error(boundary);
  const proposal=buildProposal(intent,volume===undefined?{}:{uiVolume:volume});
  return {schemaVersion:1,interpretation:{...interpretation,rawText,intent},proposal,personalEvidence:personalEvidence(proposal,values),explanation:[`Objetivo revisado: ${dictionaries.es.goals[intent.goal]}. Regla ${proposal.ruleId} (${proposal.ruleVersion}).`,...proposal.rationale,'Una sola opción validada por las reglas actuales. Suave/profunda describen el diseño, no potencia médica. El historial no cambia la selección ni el orden de recomendaciones.','Las observaciones personales no demuestran eficacia médica ni causalidad.']};
}
/** Rebuild executable output at confirmation. Never trust a supplied schedule. */
export function validateGuidedRecommendation(value: GuidedRecommendationV1, experimentalConsent: boolean) {
  if(value.schemaVersion!==1)throw new Error('Versión de recomendación desconocida.');
  const edits=value.proposal.source==='user-customized'?value.proposal.harmonicConfig.uiVolume:undefined;
  const rebuilt=recommendGuided(value.interpretation,[],edits).proposal;
  if(JSON.stringify(rebuilt)!==JSON.stringify(value.proposal))throw new Error('La propuesta no coincide con la regla local. Genera otra.');
  if(rebuilt.requiresExplicitExperimentalConsent&&!experimentalConsent)throw new Error('La cascada experimental requiere consentimiento adicional.');
  return rebuilt.harmonicConfig;
}
