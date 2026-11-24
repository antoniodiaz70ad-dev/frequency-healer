import assert from 'node:assert/strict';
import test from 'node:test';
import { actionPracticeComposition, COMPOSER_RECIPES_KEY, COMPOSER_SESSIONS_KEY, COMPOSER_VERSION, defaultComposition, saveComposition, saveComposerSession, type ComposerSession } from '../src/lib/marina/composer';
import { bindComposer, canonical, COMPOSER_SYNC_KEY, localComposerDocument, mergeComposerDocuments, readSyncBinding, synchronizeComposer, validateComposerDocument, type ComposerCloud, type ComposerDocument } from '../src/lib/marina/composerSync';
import { emptyPracticeReview } from '../src/lib/marina/actionPractice';

function store() { const data = new Map<string, string>(); return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } }; }
const empty = (): ComposerDocument => ({ version: COMPOSER_VERSION, compositions: [], sessions: [] });
function cloud() {
  let row: { revision: number; payload: ComposerDocument } | null = null;
  return {
    read: async () => structuredClone(row),
    compareAndSet: async (_user: string, revision: number, payload: ComposerDocument) => {
      if ((row?.revision ?? 0) !== revision) return false;
      row = { revision: revision + 1, payload: structuredClone(payload) }; return true;
    },
  } satisfies ComposerCloud;
}
const saved = (id = 'recipe') => ({ id, savedAt: '2026-11-23T10:00:00Z', recipe: defaultComposition() });
const session = (): ComposerSession => ({ id: 'session', startedAt: '2026-11-23T10:00:00Z', endedAt: '2026-11-23T10:08:00Z', elapsedMs: 480000, status: 'completed', recipe: actionPracticeComposition(), experience: 'Mi observación', practiceReview: emptyPracticeReview(0) });

test('a second device retrieves recipes and complete diary; offline additions converge without duplicates', async () => {
  const first = store(), second = store(), remote = cloud();
  saveComposition(first, saved()); saveComposerSession(first, session());
  bindComposer(first, 'owner'); bindComposer(second, 'owner');
  await synchronizeComposer(first, remote, 'owner'); await synchronizeComposer(second, remote, 'owner');
  assert.equal(canonical(localComposerDocument(first)), canonical(localComposerDocument(second)));
  saveComposition(second, saved('offline'));
  await synchronizeComposer(second, remote, 'owner'); await synchronizeComposer(first, remote, 'owner');
  assert.equal(localComposerDocument(first).compositions.length, 2);
  await synchronizeComposer(second, remote, 'owner');
  assert.equal(localComposerDocument(second).compositions.length, 2);
  assert.equal(localComposerDocument(first).sessions[0].practiceReview?.focusBefore, 0);
});

test('ordinary edits use the merge base; concurrent edits preserve both exact recipes idempotently', async () => {
  const first = store(), second = store(), remote = cloud();
  saveComposition(first, saved()); bindComposer(first, 'owner'); bindComposer(second, 'owner');
  await synchronizeComposer(first, remote, 'owner'); await synchronizeComposer(second, remote, 'owner');
  const edited = saved(); edited.recipe.layers[0].rateHz = .32789; edited.savedAt = '2026-11-23T11:00:00Z';
  saveComposition(first, edited); await synchronizeComposer(first, remote, 'owner');
  await synchronizeComposer(second, remote, 'owner');
  assert.equal(localComposerDocument(second).compositions.length, 1);
  assert.equal(localComposerDocument(second).compositions[0].recipe.layers[0].rateHz, .32789);
  const a = structuredClone(edited), b = structuredClone(edited); a.recipe.layers[0].rateHz = .3879; b.recipe.layers[0].rateHz = .378394;
  saveComposition(first, a); saveComposition(second, b);
  await synchronizeComposer(first, remote, 'owner');
  assert.equal((await synchronizeComposer(second, remote, 'owner')).conflicts, 1);
  await synchronizeComposer(first, remote, 'owner'); await synchronizeComposer(second, remote, 'owner');
  assert.deepEqual(localComposerDocument(second).compositions.map(row => row.recipe.layers[0].rateHz).sort(), [.378394, .3879]);
  assert.equal(canonical(localComposerDocument(first)), canonical(localComposerDocument(second)));
});

test('original observations stay intact and follow-ups combine across devices, including conflicting IDs', async () => {
  const a = empty(), b = empty(); a.sessions = [session()]; b.sessions = [session()];
  a.sessions[0].actionFollowUps = [{ id: 'u', recordedAt: '2026-11-23T11:00:00Z', actionStatus: 'done', evidence: 'Un hecho' }];
  b.sessions[0].actionFollowUps = [{ id: 'u', recordedAt: '2026-11-23T11:00:00Z', actionStatus: 'partial', evidence: 'Otro hecho' }];
  const merged = await mergeComposerDocuments(a, b);
  assert.equal(merged.document.sessions[0].experience, 'Mi observación');
  assert.equal(merged.document.sessions[0].actionFollowUps?.length, 2);
  assert.equal((await mergeComposerDocuments(a, merged.document)).document.sessions[0].actionFollowUps?.length, 2);
  a.sessions[0].experience = 'Observación distinta';
  const conflict = await mergeComposerDocuments(a, b);
  assert.equal(conflict.document.sessions.length, 2);
  assert.deepEqual(conflict.document.sessions.map(row => row.experience).sort(), ['Mi observación', 'Observación distinta']);
});

test('CAS retries and local edits during a network await are both retained', async () => {
  const local = store(), remote = cloud(); bindComposer(local, 'owner'); saveComposition(local, saved());
  let changed = false;
  const adapter: ComposerCloud = { ...remote, compareAndSet: async (user, rev, payload) => {
    if (!changed) { changed = true; saveComposition(local, saved('new-during-upload')); }
    return remote.compareAndSet(user, rev, payload);
  } };
  await synchronizeComposer(local, adapter, 'owner');
  assert.equal((await remote.read())?.payload.compositions.length, 2);
  let attempts = 0;
  const racing: ComposerCloud = { ...remote, compareAndSet: async () => { attempts++; return false; } };
  saveComposition(local, saved('unsynced'));
  await assert.rejects(synchronizeComposer(local, racing, 'owner'), /simultáneos/);
  assert.equal(attempts, 4); assert.equal(localComposerDocument(local).compositions.length, 3);
});

test('network/quota failures never acknowledge success or erase local records; remote copy remains recoverable', async () => {
  const first = store(), second = store(), remote = cloud();
  bindComposer(first, 'owner'); saveComposition(first, saved()); saveComposerSession(first, session());
  await synchronizeComposer(first, remote, 'owner'); bindComposer(second, 'owner');
  const failing = { ...second, setItem: (key: string, value: string) => { if (key === COMPOSER_SESSIONS_KEY) throw new Error('quota'); second.setItem(key, value); } };
  await assert.rejects(synchronizeComposer(failing, remote, 'owner'), /quota/);
  assert.equal(readSyncBinding(second)?.lastSyncedAt, undefined);
  assert.equal((await remote.read())?.payload.sessions.length, 1);
  await synchronizeComposer(second, remote, 'owner');
  assert.equal(localComposerDocument(second).sessions.length, 1);
  const before = canonical(localComposerDocument(second)), priorSync = second.getItem(COMPOSER_SYNC_KEY);
  await assert.rejects(synchronizeComposer(second, { ...remote, read: async () => { throw new Error('offline'); } }, 'owner'), /offline/);
  assert.equal(canonical(localComposerDocument(second)), before); assert.equal(second.getItem(COMPOSER_SYNC_KEY), priorSync);
});

test('account switch, paused sync, malformed data and invalid cloud documents block transfer', async () => {
  const local = store(), remote = cloud(); bindComposer(local, 'owner'); saveComposition(local, saved());
  assert.throws(() => bindComposer(local, 'different'), /otra cuenta/);
  await assert.rejects(synchronizeComposer(local, remote, 'different'), /cambió la cuenta/);
  bindComposer(local, 'owner', false);
  await assert.rejects(synchronizeComposer(local, remote, 'owner'), /pausó/);
  bindComposer(local, 'owner');
  const original = local.getItem(COMPOSER_RECIPES_KEY)!; local.setItem(COMPOSER_RECIPES_KEY, 'malformed');
  await assert.rejects(synchronizeComposer(local, remote, 'owner'), /Se conserva/);
  assert.equal(await remote.read(), null); assert.equal(local.getItem(COMPOSER_RECIPES_KEY), 'malformed');
  local.setItem(COMPOSER_RECIPES_KEY, original);
  const invalid = { ...empty(), compositions: [saved(), saved()] };
  assert.throws(() => validateComposerDocument(invalid), /repetidos/);
  await assert.rejects(synchronizeComposer(local, { ...remote, read: async () => ({ revision: 1, payload: invalid }) }, 'owner'), /repetidos/);
  let active = true;
  await assert.rejects(synchronizeComposer(local, { ...remote, read: async () => { active = false; return null; } }, 'owner', () => active), /pausó/);
  assert.equal(await remote.read(), null);
});
