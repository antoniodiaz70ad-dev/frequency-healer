import { validateIntent, text } from './validation';
import type { VoiceGoal, DesiredState, ParsedIntentionV1 } from './types';

export const CANONICAL_INTENT_TAXONOMY_VERSION = 'guided-mapping-v1';

type IntentAlias = { pattern: RegExp; goal: VoiceGoal; states: DesiredState[]; explanation: string };
const VOCAB: Array<[VoiceGoal, RegExp, DesiredState[]]> = [
  ['clarity', /claridad|clarity|decisi[oó]n|decision/, ['calm', 'focus']],
  ['focus', /concentr|enfoque|focus/, ['focus']],
  ['relaxation', /relaja|calma|relax|calm/, ['calm']],
  ['reflection', /reflexi|reflect/, ['openness']],
  ['creative_exploration', /creativ/, ['creative']],
  ['sleep_preparation', /dormir|sue[nñ]o|sleep|bedtime/, ['restful']],
];
const ALIASES: IntentAlias[] = [
  { pattern: /drenad|drenaje|agotad|recuper|sin energ[ií]a|cansad|deplet|recover/, goal: 'relaxation', states: ['calm', 'grounded'], explanation: 'Interpretamos esta expresión como una intención de recuperación y centrado subjetivos. No asumimos un mecanismo de drenaje energético.' },
  { pattern: /centrad|centrarme|arraig|ground|presencia/, goal: 'relaxation', states: ['grounded'], explanation: 'Centrado y presencia se mapean a Relajación; no existe una categoría acústica separada de grounding.' },
  { pattern: /tens[oa]|estr[eé]s|regula.*emoci/, goal: 'relaxation', states: ['calm'], explanation: 'La tensión percibida se interpreta como intención de calma, sin diagnosticar su causa.' },
  { pattern: /dispers|distrai/, goal: 'focus', states: ['focus'], explanation: 'La dispersión se interpreta como intención de enfoque.' },
  { pattern: /medita|integraci|integrar/, goal: 'reflection', states: ['calm', 'openness'], explanation: 'Meditación e integración se mapean a Reflexión y apertura.' },
];
const NUMBERS: Record<string, number> = { cinco: 5, diez: 10, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, five: 5, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60 };

export interface CanonicalIntentInterpretationV1 { schemaVersion: 1; taxonomyVersion: typeof CANONICAL_INTENT_TAXONOMY_VERSION; rawText: string; intent: ParsedIntentionV1; explanation: string }
export function guidanceBoundary(raw: string): string | null {
  return /dolor|mareo|desmayo|falta de aire|dificultad.*respir|palpitaci|curar|curaci[oó]n|tratar.*(?:enfermedad|ansiedad|depresi)|diagn[oó]st|medicaci[oó]n|suicid/i.test(raw)
    ? 'Esta guía no prescribe sesiones para síntomas o tratamientos. Busca evaluación profesional si describes síntomas; ante síntomas intensos o repentinos, atención urgente. Puedes volver a expresar una intención de exploración no clínica.' : null;
}
function baseParse(raw: string, language = 'es-MX') {
  const intention = text(raw), lower = intention.toLowerCase();
  const matches = VOCAB.filter(([, pattern]) => pattern.test(lower));
  const durationMatch = lower.match(/(\d+(?:[.,]\d+)?|cinco|diez|quince|veinte|treinta|cuarenta|cincuenta|sesenta|five|ten|fifteen|twenty|thirty|forty|fifty|sixty)\s*(?:minutos?|minutes?|mins?)(?!\w)/);
  const duration = durationMatch ? NUMBERS[durationMatch[1]] ?? Number(durationMatch[1].replace(',', '.')) : 15;
  const goal = matches[0]?.[0] ?? 'custom';
  const intensity = /experimental/.test(lower) ? 'experimental' : /profund|\bdeep\b/.test(lower) ? 'deep' : 'gentle';
  return validateIntent({ schemaVersion: 1, intention, goal, desiredStates: matches[0]?.[2] ?? [], durationMinutes: duration,
    intensity, sessionKind: 'exploratory', language, confidence: { goal: matches.length === 1 ? 1 : 0, durationMinutes: durationMatch ? 1 : 0, intensity: /experimental|profund|\bdeep\b|suave|gentle/.test(lower) ? 1 : 0 },
    requiresReview: [...(matches.length !== 1 ? ['goal'] : []), ...(!durationMatch ? ['durationMinutes'] : []), ...(!/experimental|profund|\bdeep\b|suave|gentle/.test(lower) ? ['intensity'] : [])] });
}
export function interpretCanonicalIntent(raw: string, language = 'es-MX'): CanonicalIntentInterpretationV1 {
  const rawText = text(raw), boundary = guidanceBoundary(rawText); if (boundary) throw new Error(boundary);
  const parsed = baseParse(rawText, language), lower = rawText.toLowerCase(), aliases = ALIASES.filter(a => a.pattern.test(lower));
  const alias = parsed.goal === 'custom' && aliases.length === 1 ? aliases[0] : undefined;
  const ambiguousAlias = parsed.goal === 'custom' && aliases.length > 1;
  const intent = alias ? validateIntent({ ...parsed, goal: alias.goal, desiredStates: alias.states, confidence: { ...parsed.confidence, goal: 1 }, requiresReview: [...new Set([...parsed.requiresReview, 'goal'])] }) : parsed;
  return { schemaVersion: 1, taxonomyVersion: CANONICAL_INTENT_TAXONOMY_VERSION, rawText, intent, explanation: alias?.explanation ?? (ambiguousAlias ? 'Hay varias pistas en el texto. Conservamos la intención para revisión antes de proponer una sesión.' : 'Interpretación local revisable. Si falta información, se proponen 15 minutos y diseño suave; no se infiere eficacia.') };
}
export function parseLocalIntent(raw: string, language = 'es-MX') { return interpretCanonicalIntent(raw, language).intent; }
