import { DESIRED_STATES, GOALS, type ParsedIntentionV1, type SelfRatingV1 } from './types';
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Datos inválidos.');
  return value as Record<string, unknown>;
}
export function text(value: unknown, max = 500, optional = false): string {
  if (typeof value !== 'string' || (!optional && !value.trim()) || value.trim().length > max) throw new Error(`Texto: máximo ${max} caracteres.`);
  return value.trim();
}
export function validateIntent(value: unknown): ParsedIntentionV1 {
  const v = object(value);
  if (v.schemaVersion !== 1 || v.sessionKind !== 'exploratory' || !GOALS.includes(v.goal as never)) throw new Error('Objetivo o versión inválidos. Revisa el formulario.');
  if (!Number.isInteger(v.durationMinutes) || Number(v.durationMinutes) < 5 || Number(v.durationMinutes) > 60) throw new Error('Duración: entero entre 5 y 60 minutos.');
  if (!['gentle', 'deep', 'experimental'].includes(String(v.intensity))) throw new Error('Intensidad inválida.');
  if (!Array.isArray(v.desiredStates) || v.desiredStates.length > 3 || v.desiredStates.some(s => !DESIRED_STATES.includes(s))) throw new Error('Elige hasta 3 estados.');
  const confidence = object(v.confidence);
  const cleanConfidence: Record<string, number> = {};
  for (const key of ['goal', 'durationMinutes', 'intensity']) {
    if (confidence[key] !== undefined) {
      if (typeof confidence[key] !== 'number' || !Number.isFinite(confidence[key]) || confidence[key] < 0 || confidence[key] > 1) throw new Error('Confianza inválida.');
      cleanConfidence[key] = confidence[key];
    }
  }
  if (!Array.isArray(v.requiresReview) || v.requiresReview.some(k => !['goal', 'durationMinutes', 'intensity', 'desiredStates'].includes(k))) throw new Error('Campos de revisión inválidos.');
  return { schemaVersion: 1, intention: text(v.intention), goal: v.goal as ParsedIntentionV1['goal'],
    ...(v.customGoal === undefined ? {} : { customGoal: text(v.customGoal, 500, true) }),
    desiredStates: [...new Set(v.desiredStates)] as ParsedIntentionV1['desiredStates'], durationMinutes: v.durationMinutes as number,
    intensity: v.intensity as ParsedIntentionV1['intensity'], sessionKind: 'exploratory', language: text(v.language, 20),
    confidence: cleanConfidence, requiresReview: [...v.requiresReview] };
}
export function parseIntentJSON(raw: string) { return validateIntent(JSON.parse(raw)); }
export function validateRatings(value: unknown): Partial<SelfRatingV1> {
  const v = object(value), result: Partial<SelfRatingV1> = {};
  for (const key of ['clarity', 'stress', 'focus'] as const) {
    if (v[key] !== undefined) {
      if (!Number.isInteger(v[key]) || Number(v[key]) < 0 || Number(v[key]) > 10) throw new Error('Escalas: enteros de 0 a 10.');
      result[key] = Number(v[key]);
    }
  }
  return result;
}
