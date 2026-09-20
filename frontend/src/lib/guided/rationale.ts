import { RATIOS } from '../harmonic/math';
import { buildProposal, validateProposal } from '../voice/rules';
import type { VoiceSessionProposalV1 } from '../voice/types';

export const EVIDENCE_LABELS = {
  mathematical: 'Matemática', acoustic: 'Acústica', 'protocol-design': 'Diseño de protocolo',
  traditional: 'Tradicional / histórica', exploratory: 'Exploratoria', 'personal-n1': 'Personal N=1',
} as const;
export interface ProtocolComponentRationaleV1 {
  componentType: 'seed' | 'ratio' | 'octave' | 'mode' | 'duration' | 'volume' | 'constellation';
  value: string;
  role: string;
  basis: keyof typeof EVIDENCE_LABELS;
  explanation: string;
  evidence?: string;
}
export interface ProtocolRationaleV1 {
  schemaVersion: 1;
  purpose: string;
  components: readonly ProtocolComponentRationaleV1[];
  limitations: readonly string[];
}
export interface HarmonicRecommendationRuleV1 {
  schemaVersion: 1;
  id: string;
  generationVersion: 'voice-rules-v1';
  intentCategory: VoiceSessionProposalV1['intent']['goal'];
  intensity: VoiceSessionProposalV1['intent']['intensity'];
  candidateType: 'legacy-harmonic-config';
  rationale: ProtocolRationaleV1;
}
/** Explanation only: frequencies/order come from the validated existing schedule. */
export function protocolRationale(value: VoiceSessionProposalV1): ProtocolRationaleV1 {
  const proposal = validateProposal(value), config = proposal.harmonicConfig;
  const original = buildProposal(proposal.intent).harmonicConfig;
  const components: ProtocolComponentRationaleV1[] = [{
    componentType: 'seed', value: `${config.baseHz} Hz`, role: 'Referencia de las relaciones sonoras', basis: 'protocol-design',
    explanation: config.baseHz === original.baseHz
      ? `La regla existente ${proposal.ruleId} usa esta base de referencia. Es una elección de diseño; no una frecuencia demostrada para producir el estado solicitado.`
      : 'Base elegida por ti sobre la regla existente; no se atribuye eficacia al valor elegido.',
  }];
  // Include every audible occurrence, including repeated roots and cascade return.
  proposal.schedule.steps.forEach((step, index) => step.frequencies.forEach((hz, voice) => {
    const relation = step.ratios[voice];
    const name = Object.values(RATIOS).find(ratio => `${ratio.p}:${ratio.q}` === relation)?.label ?? 'Paso de cascada 13/12';
    components.push({ componentType: 'ratio', value: `${relation} → ${hz} Hz`,
      role: `Componente ${index + 1}.${voice + 1}: ${relation === '1:1' || relation === '(13/12)^0' ? 'referencia raíz' : name}`,
      basis: 'mathematical', explanation: `El plan existente calcula ${config.baseHz} × ${relation.replace(':', '/')} = ${hz} Hz. ${config.mode === 'sequence' ? `Comienza en ${step.offsetSeconds} s y dura ${step.durationSeconds} s.` : 'Suena junto con los otros componentes.'}`,
      evidence: `Incluido en esta posición por ${proposal.ruleId}${proposal.source === 'user-customized' ? ', con tus ajustes revisados' : ''}. La relación es matemática; no existe aquí evidencia que justifique atribuirle el estado solicitado. El recorrido y sus repeticiones son decisiones de diseño, no una dosis.`,
    });
  }));
  components.push(
    { componentType: 'mode', value: config.mode, role: config.mode === 'sequence' ? 'Separar las relaciones en el tiempo' : 'Escuchar relaciones presentes juntas', basis: 'acoustic', explanation: config.mode === 'sequence' ? 'La secuencia permite escuchar cada componente por separado. Elegir esta organización es una decisión de diseño, no una afirmación biológica.' : 'El modo simultáneo reúne los tonos; el motor conserva su normalización de ganancia por voz. Es una organización acústica, no una afirmación biológica.' },
    { componentType: 'duration', value: `${config.durationSeconds / 60} minutos`, role: 'Definir el tiempo de exploración', basis: 'protocol-design', explanation: 'Duración de la intención revisada. Si no indicaste otra, el intérprete propone 15 minutos para revisar. No representa una dosis ni una duración clínicamente eficaz.' },
    { componentType: 'volume', value: `${config.uiVolume}/100`, role: 'Ajustar el nivel de salida', basis: 'protocol-design', explanation: `La regla propone inicialmente ${original.uiVolume}/100; el valor mostrado es el que has revisado. Empieza con un nivel cómodo y detente ante incomodidad. Este control no mide decibelios ni garantiza un nivel seguro en todos los dispositivos.` },
  );
  return { schemaVersion: 1, purpose: `Explorar la intención revisada: «${proposal.intent.intention}». Observar la experiencia sin presuponer un resultado.`, components,
    limitations: ['La matemática y el comportamiento acústico no demuestran efectos biológicos ni eficacia terapéutica.', 'No se incluyen octavas ni se atribuye identidad de constelación a esta propuesta V1.', 'No se usa evidencia tradicional sin atribución ni se infiere eficacia de la popularidad de una frecuencia.', 'Los registros personales describen asociaciones, no causalidad. No modifican esta regla.'] };
}
export function recommendationRule(proposal: VoiceSessionProposalV1): HarmonicRecommendationRuleV1 {
  return { schemaVersion: 1, id: proposal.ruleId, generationVersion: proposal.ruleVersion, intentCategory: proposal.intent.goal,
    intensity: proposal.intent.intensity, candidateType: 'legacy-harmonic-config', rationale: protocolRationale(proposal) };
}
