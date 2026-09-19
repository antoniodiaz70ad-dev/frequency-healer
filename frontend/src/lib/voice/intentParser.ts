import { validateIntent, text } from './validation';
import type { VoiceGoal, DesiredState } from './types';
const VOCAB: Array<[VoiceGoal, RegExp, DesiredState[]]> = [
  ['clarity', /claridad|clarity|decisi[oó]n|decision/, ['calm', 'focus']],
  ['focus', /concentr|enfoque|focus/, ['focus']],
  ['relaxation', /relaja|calma|relax|calm/, ['calm']],
  ['reflection', /reflexi|reflect/, ['openness']],
  ['creative_exploration', /creativ/, ['creative']],
  ['sleep_preparation', /dormir|sue[nñ]o|sleep|bedtime/, ['restful']],
];
const NUMBERS: Record<string, number> = { cinco: 5, diez: 10, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, five: 5, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60 };
export function parseLocalIntent(raw: string, language = 'es-MX') {
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
