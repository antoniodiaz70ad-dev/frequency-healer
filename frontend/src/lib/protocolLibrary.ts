import type { VoiceGoal } from './voice/types';

export const PROTOCOL_LIBRARY_VERSION = 'protocol-library-v1' as const;
export const EVIDENCE_CATEGORIES = [
  'MATHEMATICAL',
  'ACOUSTIC',
  'PROTOCOL_DESIGN',
  'TRADITIONAL_HISTORICAL',
  'EXPLORATORY',
  'PERSONAL_N1',
  'PUBLISHED_EVIDENCE',
] as const;
export const SEED_SELECTION_BASES = [
  'harmonic-compatibility',
  'octave-availability',
  'supported-range-headroom',
  'deterministic-rule-design',
  'current-acoustic-ergonomics',
  'personal-n1-evidence',
  'traditional-attribution',
  'exploratory-hypothesis',
] as const;

export type EvidenceCategoryV1 = typeof EVIDENCE_CATEGORIES[number];
export type SeedSelectionBasisV1 = typeof SEED_SELECTION_BASES[number];
export type ProtocolStatusV1 = 'active' | 'exploratory' | 'deprecated';
export type LegacyProtocolDispositionV1 = {
  protocolId: string;
  status: 'exploratory' | 'deprecated';
  action: 'relabel' | 'rewrite' | 'exclude-from-new-recommendations';
};
export type RelationshipRationaleV1 = {
  relationship: '1:1' | '5:4' | '6:5' | '4:3' | '3:2' | '13/12-cascade';
  basis: readonly EvidenceCategoryV1[];
  rationale: string;
};
export type ProtocolDefinitionV1 = {
  schemaVersion: 1;
  libraryVersion: typeof PROTOCOL_LIBRARY_VERSION;
  id: string;
  version: '1.0.0';
  status: ProtocolStatusV1;
  userFacingName: string;
  description: string;
  intentCategories: readonly string[];
  targetState?: string;
  candidateRuleIds: readonly string[];
  seedSelectionBasis: readonly SeedSelectionBasisV1[];
  evidenceBasis: readonly EvidenceCategoryV1[];
  relationshipRationale: readonly RelationshipRationaleV1[];
  recommendedDurationRange: { minSeconds: number; maxSeconds: number };
  supportedPlaybackModes: readonly ['sequence'];
  limitations: readonly string[];
  personalizationSupported: true;
  notes?: string;
};

const intensities = ['gentle', 'deep', 'experimental'] as const;
export const voiceRuleIds = (goal: VoiceGoal) => intensities.map(intensity => `voice-${goal}-${intensity}`);
const common = {
  schemaVersion: 1 as const,
  libraryVersion: PROTOCOL_LIBRARY_VERSION,
  version: '1.0.0' as const,
  seedSelectionBasis: ['deterministic-rule-design', 'harmonic-compatibility', 'supported-range-headroom'] as const,
  recommendedDurationRange: { minSeconds: 60, maxSeconds: 3600 },
  supportedPlaybackModes: ['sequence'] as const,
  personalizationSupported: true as const,
  limitations: [
    'La semilla de 144 Hz y las relaciones son decisiones deterministas de diseño, no frecuencias terapéuticas.',
    'La intención describe lo que la persona desea explorar; no predice ni garantiza un resultado.',
    'La evidencia personal, si existe, permanece dinámica y descriptiva fuera de esta definición.',
  ] as const,
};
const exact = (relationship: RelationshipRationaleV1['relationship'], rationale: string): RelationshipRationaleV1 => ({
  relationship,
  basis: ['MATHEMATICAL', 'PROTOCOL_DESIGN'],
  rationale,
});

export const PROTOCOL_LIBRARY_V1: readonly ProtocolDefinitionV1[] = [
  {
    ...common, id: 'guided-clarity', status: 'active', userFacingName: 'Claridad',
    description: 'Recorrido estructurado para explorar claridad subjetiva y volver a la referencia.',
    intentCategories: ['clarity'], targetState: 'clarity', candidateRuleIds: voiceRuleIds('clarity'),
    evidenceBasis: ['MATHEMATICAL', 'ACOUSTIC', 'PROTOCOL_DESIGN', 'PERSONAL_N1'],
    relationshipRationale: [exact('5:4', 'Tercera mayor exacta dentro del recorrido ascendente.'), exact('4:3', 'Cuarta justa exacta como paso intermedio.'), exact('3:2', 'Quinta justa exacta antes del retorno.'), exact('1:1', 'Retorno a la referencia raíz.')],
  },
  {
    ...common, id: 'guided-focus', status: 'active', userFacingName: 'Enfoque',
    description: 'Alternancia simple y repetible entre referencia y quinta justa.',
    intentCategories: ['focus'], targetState: 'focus', candidateRuleIds: voiceRuleIds('focus'),
    evidenceBasis: ['MATHEMATICAL', 'ACOUSTIC', 'PROTOCOL_DESIGN', 'PERSONAL_N1'],
    relationshipRationale: [exact('1:1', 'Referencia repetida para una estructura estable.'), exact('3:2', 'Contraste exacto con la quinta justa.')],
  },
  {
    ...common, id: 'guided-calm', status: 'active', userFacingName: 'Calma',
    description: 'Recorrido breve usado para calma, recuperación, centrado y regulación emocional subjetivos.',
    intentCategories: ['relaxation', 'recovery', 'grounding', 'emotional-regulation'], targetState: 'calm / grounded', candidateRuleIds: voiceRuleIds('relaxation'),
    evidenceBasis: ['MATHEMATICAL', 'ACOUSTIC', 'PROTOCOL_DESIGN', 'PERSONAL_N1'],
    relationshipRationale: [exact('6:5', 'Tercera menor exacta elegida como primer intervalo cercano.'), exact('4:3', 'Cuarta justa exacta como transición.'), exact('1:1', 'Retorno a la referencia raíz.')],
    notes: 'Los alias no constituyen mecanismos acústicos separados; todos resuelven a relaxation en guided-mapping-v1.',
  },
  {
    ...common, id: 'guided-reflection', status: 'active', userFacingName: 'Reflexión e integración',
    description: 'Progresión breve para meditación, reflexión e integración subjetiva.',
    intentCategories: ['reflection', 'meditation', 'integration'], targetState: 'openness', candidateRuleIds: voiceRuleIds('reflection'),
    evidenceBasis: ['MATHEMATICAL', 'ACOUSTIC', 'PROTOCOL_DESIGN', 'PERSONAL_N1'],
    relationshipRationale: [exact('5:4', 'Tercera mayor exacta como apertura del recorrido.'), exact('4:3', 'Cuarta justa exacta como transición.'), exact('1:1', 'Retorno a la referencia raíz.')],
  },
  {
    ...common, id: 'guided-sleep-preparation', status: 'active', userFacingName: 'Preparación para dormir',
    description: 'Diseño mínimo de bajo volumen inicial para preparar una rutina de descanso, sin prometer sueño.',
    intentCategories: ['sleep-preparation'], targetState: 'restful', candidateRuleIds: voiceRuleIds('sleep_preparation'),
    evidenceBasis: ['MATHEMATICAL', 'ACOUSTIC', 'PROTOCOL_DESIGN', 'PERSONAL_N1'],
    relationshipRationale: [exact('6:5', 'Tercera menor exacta elegida para un recorrido mínimo.'), exact('1:1', 'Retorno a la referencia raíz.')],
  },
  {
    ...common, id: 'guided-creative-exploration', status: 'exploratory', userFacingName: 'Exploración creativa',
    description: 'Cascada 13/12 experimental de expansión y retorno, con consentimiento adicional.',
    intentCategories: ['creative-exploration'], targetState: 'creative', candidateRuleIds: voiceRuleIds('creative_exploration'),
    seedSelectionBasis: [...common.seedSelectionBasis, 'exploratory-hypothesis'],
    evidenceBasis: ['MATHEMATICAL', 'ACOUSTIC', 'PROTOCOL_DESIGN', 'EXPLORATORY', 'PERSONAL_N1'],
    relationshipRationale: [{ relationship: '13/12-cascade', basis: ['MATHEMATICAL', 'PROTOCOL_DESIGN', 'EXPLORATORY'], rationale: 'Potencias exactas de 13/12 en una cascada de expansión y retorno; no se les atribuye un efecto terapéutico.' }],
  },
  {
    ...common, id: 'guided-custom-review', status: 'exploratory', userFacingName: 'Exploración personalizada',
    description: 'Fallback neutral para una intención que el intérprete local no pudo clasificar con confianza.',
    intentCategories: ['custom'], candidateRuleIds: voiceRuleIds('custom'),
    evidenceBasis: ['MATHEMATICAL', 'ACOUSTIC', 'PROTOCOL_DESIGN', 'EXPLORATORY', 'PERSONAL_N1'],
    relationshipRationale: [exact('1:1', 'Referencia dentro de una configuración neutral revisable.'), exact('3:2', 'Quinta justa exacta como contraste neutral.')],
    notes: 'No debe presentarse como recomendación comprendida: requiresReview conserva la decisión humana antes de confirmar.',
  },
] as const;

/** Classification only. Legacy records, lookup, copy and playback remain unchanged in Phase 3C. */
export const LEGACY_PROTOCOL_DISPOSITIONS_V1: readonly LegacyProtocolDispositionV1[] = [
  { protocolId: 'solfeggio-ascension', status: 'exploratory', action: 'relabel' },
  { protocolId: 'sanacion-cuerpo', status: 'deprecated', action: 'exclude-from-new-recommendations' },
  { protocolId: 'meditacion-profunda', status: 'exploratory', action: 'rewrite' },
  { protocolId: 'gamma-neuroproteccion', status: 'deprecated', action: 'exclude-from-new-recommendations' },
  { protocolId: 'desintoxicacion', status: 'deprecated', action: 'exclude-from-new-recommendations' },
  { protocolId: 'sueno-profundo', status: 'exploratory', action: 'rewrite' },
  { protocolId: 'equilibrio-432', status: 'exploratory', action: 'relabel' },
  { protocolId: 'despertar-espiritual', status: 'exploratory', action: 'relabel' },
  { protocolId: 'frecuencia-milagro', status: 'deprecated', action: 'exclude-from-new-recommendations' },
  { protocolId: 'antiparasitario', status: 'deprecated', action: 'exclude-from-new-recommendations' },
  { protocolId: 'resonancia-alfa-iq', status: 'deprecated', action: 'exclude-from-new-recommendations' },
  { protocolId: 'samadhi-alpha', status: 'exploratory', action: 'rewrite' },
  { protocolId: 'satori-alpha', status: 'exploratory', action: 'rewrite' },
  { protocolId: 'neurofeedback-alfa', status: 'deprecated', action: 'exclude-from-new-recommendations' },
  { protocolId: 'sincronizacion-grupal', status: 'deprecated', action: 'exclude-from-new-recommendations' },
] as const;

export function protocolForRuleId(ruleId: string): ProtocolDefinitionV1 | undefined {
  return PROTOCOL_LIBRARY_V1.find(protocol => protocol.candidateRuleIds.includes(ruleId));
}
