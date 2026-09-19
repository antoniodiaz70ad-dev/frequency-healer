import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoiceStore, SESSIONS_KEY, validateRecord, type StorageLike, type Lock } from '../src/lib/voice/storage';
import { buildProposal } from '../src/lib/voice/rules';
import { parseLocalIntent } from '../src/lib/voice/intentParser';
import { n1Summary } from '../src/lib/voice/analytics';
import type { VoiceSessionRecordV1 } from '../src/lib/voice/types';
class Memory implements StorageLike {
  map = new Map<string, string>();
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
}
const lock: Lock = async operation => operation();
function fixture(id = 'one', delta = 2): VoiceSessionRecordV1 {
  const proposal = buildProposal(parseLocalIntent('focus 10 minutes'));
  return { schemaVersion: 1, id, createdAt: '2026-09-19T10:00:00.000Z', completedAt: '2026-09-19T10:10:00.000Z', status: 'completed', intent: proposal.intent, proposal, before: { clarity: 3, stress: 6, focus: 4 }, after: { clarity: 3 + delta, stress: 4, focus: 5 }, markers: [], technical: { actualDurationMs: 600000 } };
}
test('save/read/delete/clear preserve protected keys byte for byte; no audio persisted', async () => {
  const memory = new Memory(), store = new VoiceStore(memory, lock);
  const keys = ['fh:obe-session-logs-v1', 'fh:next-session-config-v1', 'fh:harmonic-presets-v1']; keys.forEach(k => memory.setItem(k, ' [  { "unchanged" : true } ] '));
  const before = keys.map(k => memory.getItem(k));
  await store.save({ ...fixture(), audio: 'secret-audio', transcript: 'original' } as VoiceSessionRecordV1);
  assert.equal(store.load().length, 1); assert.equal(memory.getItem(SESSIONS_KEY)!.includes('secret-audio'), false); assert.equal('transcript' in store.load()[0], false);
  await store.remove('one'); assert.equal(store.load().length, 0); await store.save(fixture()); await store.clear();
  assert.deepEqual(keys.map(k => memory.getItem(k)), before);
});
test('corrupt JSON / version / nested payload cannot be overwritten, quota remains explicit', async () => {
  const memory = new Memory(), store = new VoiceStore(memory, lock);
  for (const raw of ['{broken', '[{"schemaVersion":99}]', JSON.stringify([{ ...fixture(), before: { clarity: 99 } }])]) {
    memory.setItem(SESSIONS_KEY, raw); await assert.rejects(store.save(fixture()), /inválido/); assert.equal(memory.getItem(SESSIONS_KEY), raw);
  }
  const quota = new VoiceStore({ getItem: () => null, setItem: () => { throw new Error('quota'); } }, lock);
  await assert.rejects(quota.save(fixture()), /quota/);
});
test('limit 100 without eviction; read latest under serialized lock across tabs', async () => {
  const memory = new Memory(); memory.setItem(SESSIONS_KEY, JSON.stringify(Array.from({ length: 100 }, (_, i) => fixture(String(i)))));
  const store = new VoiceStore(memory, lock); await assert.rejects(store.save(fixture('101')), /100/); assert.equal(store.load().length, 100);
  memory.map.clear(); let queue = Promise.resolve();
  const serialized: Lock = operation => { const next = queue.then(operation); queue = next.then(() => {}, () => {}); return next; };
  const a = new VoiceStore(memory, serialized), b = new VoiceStore(memory, serialized);
  await Promise.all([a.save(fixture('a')), b.save(fixture('b'))]); assert.equal(a.load().length, 2);
});
test('N=1 thresholds, exact mean/median, duration/architecture separation, missing pairs', () => {
  const rows = Array.from({ length: 11 }, (_, i) => fixture(String(i), i % 3));
  assert.deepEqual(n1Summary(rows.slice(0, 4)), []);
  const preliminary = n1Summary(rows.slice(0, 5))[0].metrics[0];
  assert.equal(preliminary.label, 'señal preliminar'); assert.equal(preliminary.mean, 0.8); assert.equal(preliminary.median, 1);
  assert.equal(n1Summary(rows)[0].metrics[0].label, 'patrón observado');
  const incomplete = rows.map(r => ({ ...r, after: { focus: 5 } })); assert.ok(n1Summary(incomplete)[0].metrics.every(m => m.metric === 'focus'));
  assert.deepEqual(n1Summary(rows.map(r => ({ ...r, status: 'stopped' as const }))), []);
  assert.deepEqual(n1Summary(rows.slice(0, 5).map((r, i) => ({ ...r, proposal: { ...r.proposal, harmonicConfig: { ...r.proposal.harmonicConfig, baseHz: i === 0 ? 220 : 144 } } }))), []);
});
test('runtime schema rejects mismatched schedules and invalid marker offsets', () => {
  const row = fixture(); row.proposal.schedule.steps[0].frequencies = [999]; assert.throws(() => validateRecord(row));
  assert.throws(() => validateRecord({ ...fixture(), markers: [{ id: 'x', kind: 'custom', offsetMs: 700000, wallClockCreatedAt: '2026-09-19', harmonicSnapshot: { stepIndex: 0, baseHz: 144, activeHz: [144], ratioId: 'fifth' } }] }));
});
