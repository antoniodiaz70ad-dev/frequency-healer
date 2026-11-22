/** An app adaptation of mental contrasting and if–then planning, independent of audio. */
export const ACTION_PRACTICE_VERSION = 'intention-action-1';
export type ActionPlan = {
  version: typeof ACTION_PRACTICE_VERSION;
  goal: string; outcome: string; obstacle: string; cue: string;
  response: string; nextAction: string; when: string;
};
export type ActionStatus = 'pending' | 'done' | 'partial' | 'not-done';
export type PracticeReview = {
  version: typeof ACTION_PRACTICE_VERSION;
  focusBefore: number | null; focusAfter: number | null; distractions: number | null;
  actionStatus: ActionStatus; evidence: string;
};
export type ActionFollowUp = {
  id: string; recordedAt: string; actionStatus: Exclude<ActionStatus, 'pending'>; evidence: string;
};
export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  pending: 'Por realizar', done: 'Realizada', partial: 'Avance parcial', 'not-done': 'No realizada',
};
export const ACTION_PHASES = [
  { id: 'settle', name: 'Estabiliza', end: .25 },
  { id: 'wish', name: 'Elige tu meta', end: .375 },
  { id: 'outcome', name: 'Imagina el resultado', end: .5 },
  { id: 'obstacle', name: 'Reconoce el obstáculo', end: .625 },
  { id: 'plan', name: 'Ensaya tu respuesta', end: .875 },
  { id: 'action', name: 'Prepara tu primera acción', end: 1 },
] as const;

export function emptyActionPlan(): ActionPlan {
  return { version: ACTION_PRACTICE_VERSION, goal: '', outcome: '', obstacle: '', cue: '', response: '', nextAction: '', when: 'Al terminar esta sesión' };
}
export function emptyPracticeReview(focusBefore: number | null = null): PracticeReview {
  return { version: ACTION_PRACTICE_VERSION, focusBefore, focusAfter: null, distractions: null, actionStatus: 'pending', evidence: '' };
}
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function text(value: unknown, max: number): value is string { return typeof value === 'string' && value.length <= max; }
function rating(value: unknown) { return value === null || typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 10; }

/** Empty fields are valid saved drafts; starting a practice requires a complete plan. */
export function validateActionPlan(value: unknown, complete = false): asserts value is ActionPlan {
  if (!object(value) || value.version !== ACTION_PRACTICE_VERSION ||
      !['goal', 'outcome', 'obstacle', 'cue', 'response', 'nextAction'].every(key => text(value[key], 600)) || !text(value.when, 160)) {
    throw new Error('El plan de intención y acción tiene un formato diferente.');
  }
  if (complete && !['goal', 'outcome', 'obstacle', 'cue', 'response', 'nextAction', 'when'].every(key => (value[key] as string).trim())) {
    throw new Error('Completa tu meta, resultado, obstáculo, plan si–entonces y primera acción antes de escuchar. Puedes guardar el borrador.');
  }
}
export function validatePracticeReview(value: unknown): asserts value is PracticeReview {
  if (!object(value) || value.version !== ACTION_PRACTICE_VERSION || !rating(value.focusBefore) || !rating(value.focusAfter) ||
      !(value.distractions === null || typeof value.distractions === 'number' && Number.isInteger(value.distractions) && value.distractions >= 0 && value.distractions <= 999) ||
      !Object.hasOwn(ACTION_STATUS_LABELS, String(value.actionStatus)) || !text(value.evidence, 2000)) {
    throw new Error('Revisa las valoraciones y el registro de tu acción.');
  }
}
export function validateActionFollowUps(value: unknown): asserts value is ActionFollowUp[] {
  if (!Array.isArray(value)) throw new Error('El seguimiento de acciones tiene un formato diferente.');
  const ids = new Set<string>();
  for (const row of value) {
    if (!object(row) || typeof row.id !== 'string' || !row.id || ids.has(row.id) ||
        typeof row.recordedAt !== 'string' || !Number.isFinite(Date.parse(row.recordedAt)) ||
        !['done', 'partial', 'not-done'].includes(String(row.actionStatus)) || !text(row.evidence, 2000) || !row.evidence.trim()) {
      throw new Error('Cada seguimiento necesita fecha, resultado y una nota concreta.');
    }
    ids.add(row.id);
  }
}

/** Uses the existing active audio clock; no independent countdown or sound source. */
export function actionPhaseAt(elapsedMs: number, durationMs: number) {
  if (!Number.isFinite(elapsedMs) || !Number.isFinite(durationMs) || durationMs <= 0) throw new Error('Tiempo de práctica inválido.');
  const fraction = Math.max(0, Math.min(1, elapsedMs / durationMs));
  return ACTION_PHASES.find(phase => fraction < phase.end) ?? ACTION_PHASES[ACTION_PHASES.length - 1];
}
export function actionPhasePrompt(id: typeof ACTION_PHASES[number]['id'], plan: ActionPlan) {
  switch (id) {
    case 'settle': return 'Respira naturalmente. Siente el apoyo del cuerpo y vuelve con suavidad cuando te distraigas.';
    case 'wish': return `Elige una meta importante y factible bajo tu influencia: ${plan.goal}`;
    case 'outcome': return `Imagina una escena breve que represente este resultado: ${plan.outcome}`;
    case 'obstacle': return `Reconoce sin juzgar el obstáculo interno: ${plan.obstacle}. Considera también los límites externos reales.`;
    case 'plan': return `Si ${plan.cue}, entonces ${plan.response}. Ensaya la señal, tu respuesta y el siguiente paso.`;
    case 'action': return `Tu primera acción: ${plan.nextAction}. Cuándo: ${plan.when}. Al terminar, registra qué pudiste hacer.`;
  }
}
