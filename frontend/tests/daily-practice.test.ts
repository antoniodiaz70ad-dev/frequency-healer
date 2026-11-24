import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDailyAction, currentDailyAction, dailyIntent, latestActionSession, validateDailyAction } from '../src/lib/voice/dailyPractice';
import { SESSIONS_KEY, VoiceStore, validateRecord, type Lock, type StorageLike } from '../src/lib/voice/storage';
import { buildProposal } from '../src/lib/voice/rules';
import type { VoiceSessionRecordV1 } from '../src/lib/voice/types';
import { createUnifiedExport, verifyUnifiedExport } from '../src/lib/dataExport';

class Memory implements StorageLike {
  values = new Map<string, string>(); writes = 0; fail = false;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.fail) throw new Error('quota'); this.writes++; this.values.set(key, value); }
}
const lock: Lock = async operation => operation();
const at = '2026-10-21T10:00:00.000Z';
const later = '2026-10-21T11:00:00.000Z';
function fixture(id = 'daily', action = true): VoiceSessionRecordV1 {
  const intent = dailyIntent('Escuchar antes de responder', 'clarity'), proposal = buildProposal(intent);
  return { schemaVersion: 1, id, createdAt: at, completedAt: at, status: 'stopped', intent, proposal,
    before: { stress: 0 }, after: {}, markers: [], reflection: 'Observé mi prisa.', technical: { actualDurationMs: 1000 },
    ...(action ? { dailyAction: createDailyAction('Escribir tres preguntas', at) } : {}) };
}

test('daily choices reuse canonical goals and editable five-minute proposal without inferred states', () => {
  for (const goal of ['clarity', 'relaxation', 'focus'] as const) {
    const intent = dailyIntent('Mi intención propia', goal);
    assert.equal(intent.goal, goal); assert.equal(intent.durationMinutes, 5);
    assert.equal(buildProposal(intent).schedule.durationSeconds, 300);
    assert.equal(buildProposal({ ...intent, durationMinutes: 10 }).schedule.durationSeconds, 600);
  }
  assert.throws(() => dailyIntent('  ', 'clarity'));
  assert.equal(createDailyAction('  '), undefined);
});

test('session and action save atomically, survive reload, export and delete with legacy records', async () => {
  const memory = new Memory(), store = new VoiceStore(memory, lock);
  const legacy = fixture('legacy', false); await store.save(legacy); const beforeWrites = memory.writes;
  await store.save(fixture()); assert.equal(memory.writes, beforeWrites + 1);
  const records = new VoiceStore(memory, lock).load();
  assert.deepEqual(records[0], validateRecord(fixture())); assert.deepEqual(records[1], validateRecord(legacy));
  assert.equal(records[0].before?.stress, 0); assert.equal(records[0].before?.clarity, undefined);
  const exported = await createUnifiedExport(memory, later); await verifyUnifiedExport(exported);
  const namespace = exported.namespaces.find(row => row.key === SESSIONS_KEY)!;
  assert.equal(namespace.status, 'valid'); assert.deepEqual(JSON.parse(namespace.raw!)[0].dailyAction, records[0].dailyAction);
  await store.remove('daily'); assert.equal(latestActionSession(store.load()), null); assert.equal(store.load()[0].id, 'legacy');
  await store.clear(); assert.deepEqual(store.load(), []);
});

test('follow-up appends revisions, retains original action and session evidence, and selects latest action', async () => {
  const memory = new Memory(), store = new VoiceStore(memory, lock); await store.save(fixture());
  let record = store.load()[0]; const { dailyAction: original, ...evidence } = record;
  await store.updateDailyAction(record.id, original!, { text: 'Escribir tres preguntas', status: 'done' }, later);
  record = store.load()[0]; assert.equal(currentDailyAction(record.dailyAction!).status, 'done');
  await store.updateDailyAction(record.id, record.dailyAction!, { text: 'Escuchar una respuesta completa', status: 'pending' }, later);
  record = store.load()[0]; const { dailyAction, ...unchanged } = record;
  assert.deepEqual(unchanged, evidence); assert.deepEqual(dailyAction!.revisions[0], original!.revisions[0]);
  assert.equal(dailyAction!.revisions.length, 3); assert.equal(currentDailyAction(dailyAction!).status, 'pending');
  await store.save(fixture('newer-without-action', false)); assert.equal(latestActionSession(store.load())?.id, 'daily');
  await store.save({ ...fixture('newer-with-action'), dailyAction: createDailyAction('Otra acción', later) });
  assert.equal(latestActionSession(store.load())?.id, 'newer-with-action');
});

test('stale cross-tab edits and deleted records are rejected rather than overwriting another action', async () => {
  const memory = new Memory(), store = new VoiceStore(memory, lock); await store.save(fixture());
  const original = store.load()[0].dailyAction!;
  await store.updateDailyAction('daily', original, { text: 'Cambió en otra pestaña', status: 'pending' }, later);
  const bytes = memory.getItem(SESSIONS_KEY);
  await assert.rejects(store.updateDailyAction('daily', original, { text: 'Edición obsoleta', status: 'done' }, later), /Otra pestaña/);
  assert.equal(memory.getItem(SESSIONS_KEY), bytes);
  await store.remove('daily'); await assert.rejects(store.updateDailyAction('daily', original, { text: 'Revivir', status: 'pending' }, later), /no está disponible/);
});

test('quota failures leave both original session and action intact, including initial save', async () => {
  const memory = new Memory(), store = new VoiceStore(memory, lock); memory.fail = true;
  await assert.rejects(store.save(fixture()), /quota/); assert.equal(memory.getItem(SESSIONS_KEY), null);
  memory.fail = false; await store.save(fixture()); const bytes = memory.getItem(SESSIONS_KEY); memory.fail = true;
  await assert.rejects(store.updateDailyAction('daily', store.load()[0].dailyAction!, { text: 'Otra acción', status: 'done' }, later), /quota/);
  assert.equal(memory.getItem(SESSIONS_KEY), bytes);
});

test('malformed action data blocks mutation and is preserved in unified export', async () => {
  const memory = new Memory(), store = new VoiceStore(memory, lock);
  for (const dailyAction of [{ schemaVersion: 2, revisions: [] }, { schemaVersion: 1, revisions: [] }, { schemaVersion: 1, revisions: [{ text: '', status: 'pending', changedAt: at }] }]) {
    const raw = JSON.stringify([{ ...fixture(), dailyAction }]); memory.values.set(SESSIONS_KEY, raw);
    await assert.rejects(store.save(fixture('new')), /inválido/); assert.equal(memory.getItem(SESSIONS_KEY), raw);
    const exported = await createUnifiedExport(memory, later); const entry = exported.namespaces.find(row => row.key === SESSIONS_KEY)!;
    assert.equal(entry.status, 'invalid'); assert.equal(entry.raw, raw);
  }
  assert.throws(() => validateDailyAction({ schemaVersion: 1, revisions: [{ text: 'Texto', status: 'done', changedAt: at }] }));
  assert.throws(() => validateDailyAction({ schemaVersion: 1, revisions: [{ text: 'Texto', status: 'pending', changedAt: later }, { text: 'Texto', status: 'done', changedAt: at }] }));
});

test('save retries are idempotent but conflicting IDs never claim a different action was saved', async () => {
  const memory = new Memory(), store = new VoiceStore(memory, lock); await store.save(fixture()); await store.save(fixture());
  assert.equal(store.load().length, 1);
  await assert.rejects(store.save({ ...fixture(), dailyAction: createDailyAction('Otra acción', at) }), /distinta/);
  assert.equal(currentDailyAction(store.load()[0].dailyAction!).text, 'Escribir tres preguntas');
});
