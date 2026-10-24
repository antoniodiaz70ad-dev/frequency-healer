import type { DailyActionV1, DailyActionRevisionV1, ParsedIntentionV1, VoiceSessionRecordV1 } from './types';
import { object, text, validateIntent } from './validation';

export const DAILY_GOALS = ['relaxation', 'clarity', 'focus'] as const;
export type DailyGoal = typeof DAILY_GOALS[number];
export const DAILY_GOAL_LABELS = { relaxation: 'Calma', clarity: 'Claridad', focus: 'Concentración' };

export function dailyIntent(words: string, goal: DailyGoal): ParsedIntentionV1 {
  if (!DAILY_GOALS.includes(goal)) throw new Error('Elige calma, claridad o concentración.');
  return validateIntent({ schemaVersion: 1, intention: words, goal,
    desiredStates: goal === 'relaxation' ? ['calm'] : goal === 'focus' ? ['focus'] : ['calm', 'focus'],
    durationMinutes: 5, intensity: 'gentle', sessionKind: 'exploratory', language: 'es',
    confidence: {}, requiresReview: [] });
}

export function validateDailyAction(value: unknown): DailyActionV1 {
  const v = object(value);
  if (v.schemaVersion !== 1 || !Array.isArray(v.revisions) || v.revisions.length < 1 || v.revisions.length > 1000) {
    throw new Error('Acción cotidiana inválida.');
  }
  let previousTime = -Infinity;
  const revisions = v.revisions.map((raw, index): DailyActionRevisionV1 => {
    const row = object(raw), changedAt = text(row.changedAt, 50), time = Date.parse(changedAt);
    if (!['pending', 'done'].includes(String(row.status)) || (index === 0 && row.status !== 'pending') || !Number.isFinite(time) || time < previousTime) {
      throw new Error('Revisión de acción inválida.');
    }
    previousTime = time;
    return { text: text(row.text, 280), status: row.status as DailyActionRevisionV1['status'], changedAt };
  });
  return { schemaVersion: 1, revisions };
}

export function createDailyAction(value: string, changedAt = new Date().toISOString()): DailyActionV1 | undefined {
  if (!value.trim()) return undefined;
  return validateDailyAction({ schemaVersion: 1, revisions: [{ text: value, status: 'pending', changedAt }] });
}

export function currentDailyAction(action: DailyActionV1): DailyActionRevisionV1 {
  return action.revisions[action.revisions.length - 1];
}

export function latestActionSession(records: VoiceSessionRecordV1[]): VoiceSessionRecordV1 | null {
  return records.filter(record => record.dailyAction).reduce<VoiceSessionRecordV1 | null>((latest, record) =>
    !latest || Date.parse(record.dailyAction!.revisions[0].changedAt) > Date.parse(latest.dailyAction!.revisions[0].changedAt) ? record : latest, null);
}
