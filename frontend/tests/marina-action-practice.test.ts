import assert from 'node:assert/strict';
import test from 'node:test';
import { ACTION_PHASES, actionPhaseAt, emptyPracticeReview, validateActionPlan, validatePracticeReview } from '../src/lib/marina/actionPractice';
import { actionPracticeComposition, appendComposerActionFollowUp, COMPOSER_SESSIONS_KEY, defaultComposition, readCompositions, readComposerSessions, saveComposition, saveComposerSession, type ComposerSession } from '../src/lib/marina/composer';

function store() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
function plannedSession(): ComposerSession {
  const recipe = actionPracticeComposition();
  Object.assign(recipe.actionPlan!, { goal: 'Completar propuesta', outcome: 'Borrador listo', obstacle: 'Perfeccionismo', cue: 'falta un dato', response: 'lo marco y continúo', nextAction: 'Escribir tres puntos' });
  return { id: 'session', startedAt: '2026-11-22T20:00:00Z', endedAt: '2026-11-22T20:08:00Z', elapsedMs: 480000, status: 'completed', recipe, experience: 'Observación inicial', practiceReview: { ...emptyPracticeReview(0), focusAfter: 7, distractions: 0 } };
}

test('action plans save as drafts, require completion to start and preserve all three existing tones', () => {
  const storage = store(), recipe = actionPracticeComposition();
  saveComposition(storage, { id: 'draft', savedAt: '2026-11-22T20:00:00Z', recipe });
  const loaded = readCompositions(storage)[0].recipe;
  assert.throws(() => validateActionPlan(loaded.actionPlan, true), /Completa/);
  validateActionPlan(plannedSession().recipe.actionPlan, true);
  assert.deepEqual(loaded.layers.map(layer => [layer.carrierHz, layer.level]), [[259.2, .5], [324, .35], [388.8, .25]]);
  assert.equal(loaded.durationMinutes, 8);
  assert.equal(loaded.actionPlan?.goal, '');
});

test('new practice sessions coexist with legacy records and do not invent unobserved ratings', () => {
  const storage = store(), row = plannedSession();
  const legacy: ComposerSession = { ...row, id: 'legacy', recipe: defaultComposition(), practiceReview: undefined };
  storage.setItem('fh.marina.sessions.v1', 'older private journal');
  saveComposerSession(storage, legacy);
  saveComposerSession(storage, row);
  const loaded = readComposerSessions(storage);
  assert.equal(loaded.length, 2);
  assert.equal(loaded[0].practiceReview, undefined);
  assert.equal(loaded[1].practiceReview?.focusBefore, 0);
  assert.equal(loaded[1].practiceReview?.distractions, 0);
  assert.equal(emptyPracticeReview().focusBefore, null);
  assert.equal(emptyPracticeReview().focusAfter, null);
  assert.equal(storage.getItem('fh.marina.sessions.v1'), 'older private journal');
});

test('invalid practice measurements block writes while retaining stored data', () => {
  const storage = store(), row = plannedSession();
  saveComposerSession(storage, row);
  const original = storage.getItem(COMPOSER_SESSIONS_KEY);
  for (const bad of [{ focusAfter: 11 }, { focusBefore: -1 }, { distractions: 1.5 }, { actionStatus: 'success' }]) {
    assert.throws(() => saveComposerSession(storage, { ...row, practiceReview: { ...row.practiceReview!, ...bad } } as ComposerSession));
    assert.equal(storage.getItem(COMPOSER_SESSIONS_KEY), original);
  }
  assert.throws(() => validatePracticeReview({ ...emptyPracticeReview(), focusAfter: NaN }));
  storage.setItem(COMPOSER_SESSIONS_KEY, '[{"practiceReview":{}}]');
  assert.throws(() => saveComposerSession(storage, row), /Se conserva/);
  assert.equal(storage.getItem(COMPOSER_SESSIONS_KEY), '[{"practiceReview":{}}]');
});

test('later action updates append to the latest session without replacing the original observation or measurements', () => {
  const storage = store(), row = plannedSession();
  saveComposerSession(storage, row);
  const first = { id: 'one', recordedAt: '2026-11-22T20:15:00Z', actionStatus: 'partial' as const, evidence: 'Dos puntos redactados' };
  appendComposerActionFollowUp(storage, row.id, first);
  const second = { id: 'two', recordedAt: '2026-11-22T20:25:00Z', actionStatus: 'done' as const, evidence: 'Borrador completo' };
  appendComposerActionFollowUp(storage, row.id, second);
  appendComposerActionFollowUp(storage, row.id, first);
  const [loaded] = readComposerSessions(storage);
  assert.deepEqual(loaded.actionFollowUps, [first, second]);
  assert.deepEqual(loaded.practiceReview, row.practiceReview);
  assert.equal(loaded.experience, row.experience);
  assert.deepEqual(loaded.recipe, row.recipe);
  assert.throws(() => appendComposerActionFollowUp(storage, row.id, { ...first, evidence: 'Contenido diferente' }), /otro contenido/);
  assert.throws(() => appendComposerActionFollowUp(storage, row.id, { ...second, id: 'three', evidence: '  ' }));
});

test('written phases follow active audio time, including exact boundaries and later resume', () => {
  const duration = 8 * 60000;
  assert.equal(actionPhaseAt(0, duration).id, 'settle');
  assert.equal(actionPhaseAt(120000, duration).id, 'wish');
  assert.equal(actionPhaseAt(180000, duration).id, 'outcome');
  assert.equal(actionPhaseAt(240000, duration).id, 'obstacle');
  assert.equal(actionPhaseAt(300000, duration).id, 'plan');
  assert.equal(actionPhaseAt(420000, duration).id, 'action');
  assert.equal(actionPhaseAt(duration + 10000, duration).id, 'action');
  assert.deepEqual([0, .25, .375, .5, .625, .875].map(ratio => actionPhaseAt(ratio * 60000, 60000).id), ACTION_PHASES.map(phase => phase.id));
});
