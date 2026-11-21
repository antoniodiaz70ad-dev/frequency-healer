import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completedFirePhases, FireClock, FIRE_TOTAL_MS, firePhaseAt, fireSchedule } from '../src/lib/fire/protocol';
import { emptyFireData, FIRE_STORAGE_KEY, fireSummary, parseFireData, readFireData, saveFireSession, startFireProgram, type FireSession, type FireStorage } from '../src/lib/fire/storage';

class Memory implements FireStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
const session = (over: Partial<FireSession> = {}): FireSession => ({
  id: 's1', startedAt: '2026-11-07T10:00:00Z', endedAt: '2026-11-07T10:07:00Z', day: '2026-11-07',
  exercise: 'Cálculo mental', mode: 'seated', elapsedMs: FIRE_TOTAL_MS, completedPhases: completedFirePhases(FIRE_TOTAL_MS),
  status: 'completed', programStart: null, distractions: null, latency: 'unknown', recovery: null,
  presence: null, identification: null, note: '', ...over,
});

test('phase boundaries follow 1/2/2/2 minutes and report only completed phases', () => {
  for (const [time, phase] of [[0, 0], [59999, 0], [60000, 1], [179999, 1], [180000, 2], [300000, 3], [419999, 3], [420000, -1]]) assert.equal(firePhaseAt(time), phase);
  assert.equal(completedFirePhases(59999).length, 0);
  assert.equal(completedFirePhases(180000).length, 2);
  assert.equal(completedFirePhases(FIRE_TOTAL_MS).length, 4);
});

test('pause/resume excludes long pauses, repeated resume is harmless, completion clamps', () => {
  const clock = new FireClock();
  clock.resume(1000);
  clock.resume(2000);
  assert.equal(clock.pause(61000), 60000);
  assert.equal(clock.elapsed(900000), 60000);
  clock.resume(900000);
  assert.equal(clock.pause(1020000), 180000);
  clock.resume(1100000);
  assert.equal(clock.elapsed(2000000), FIRE_TOTAL_MS);
  assert.equal(clock.pause(2000000), FIRE_TOTAL_MS);
  clock.resume(3000000);
  assert.equal(clock.elapsed(3001000), FIRE_TOTAL_MS);
});

test('calendar crosses month/year correctly and rejects invalid dates', () => {
  const days = fireSchedule('2026-12-25');
  assert.equal(days.length, 14);
  assert.equal(new Set(days).size, 14);
  assert.equal(days.at(-1), '2027-01-07');
  assert.throws(() => fireSchedule('2026-02-30'));
});

test('no writes without consent; program and session reload, save is idempotent, zero survives', () => {
  const memory = new Memory();
  assert.throws(() => startFireProgram(memory, '2026-11-07', false));
  assert.throws(() => saveFireSession(memory, session(), false));
  assert.equal(memory.values.size, 0);
  startFireProgram(memory, '2026-11-07', true);
  assert.throws(() => startFireProgram(memory, '2026-11-08', true));
  saveFireSession(memory, session({ programStart: '2026-11-07', recovery: 0, distractions: 0 }), true);
  saveFireSession(memory, session({ programStart: '2026-11-07', recovery: 0, distractions: 0 }), true);
  const data = readFireData(memory);
  assert.equal(data.sessions.length, 1);
  assert.equal(data.sessions[0].distractions, 0);
  assert.equal(data.sessions[0].recovery, 0);
  memory.setItem('other-module', 'keep');
  memory.removeItem(FIRE_STORAGE_KEY);
  assert.deepEqual(readFireData(memory), emptyFireData());
  assert.equal(memory.getItem('other-module'), 'keep');
});

test('corrupt and invalid stored data is preserved rather than overwritten', () => {
  const memory = new Memory();
  for (const raw of ['{broken', JSON.stringify({ ...emptyFireData(), sessions: [session({ presence: 11 })] })]) {
    memory.setItem(FIRE_STORAGE_KEY, raw);
    assert.throws(() => readFireData(memory));
    assert.throws(() => saveFireSession(memory, session(), true));
    assert.throws(() => startFireProgram(memory, '2026-11-07', true));
    assert.equal(memory.getItem(FIRE_STORAGE_KEY), raw);
  }
});

test('validation rejects false completions, invented phases, negative counts and duplicates', () => {
  for (const row of [session({ elapsedMs: 1 }), session({ completedPhases: [] }), session({ distractions: -1 }), session({ distractions: 1.5 }), session({ latency: 'precise' as never }), session({ recovery: 0.5 }), session({ programStart: '2026-10-01' })]) {
    assert.throws(() => parseFireData(JSON.stringify({ ...emptyFireData(), sessions: [row] })));
  }
  assert.throws(() => parseFireData(JSON.stringify({ ...emptyFireData(), sessions: [session(), session()] })));
});

test('descriptive summaries exclude stopped sessions and missing values, include zero', () => {
  const summary = fireSummary([session({ recovery: 0 }), session({ id: 's2', recovery: 8, status: 'stopped', elapsedMs: 1000, completedPhases: [] }), session({ id: 's3', recovery: 4 })]);
  assert.deepEqual(summary[0], { key: 'recovery', count: 2, mean: 2 });
  assert.equal(summary[1].mean, null);
  assert.equal(summary[1].count, 0);
});
