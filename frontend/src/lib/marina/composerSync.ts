import { COMPOSER_RECIPES_KEY, COMPOSER_SESSIONS_KEY, COMPOSER_VERSION, readCompositions, readComposerSessions, type ComposerSession, type SavedComposition } from './composer';

export const COMPOSER_SYNC_KEY = 'fh.marina.composer-sync.v1';
export const COMPOSER_CHANGED = 'fh:composer-changed';
export type ComposerDocument = { version: typeof COMPOSER_VERSION; compositions: SavedComposition[]; sessions: ComposerSession[] };
export type SyncBinding = { userId: string; enabled: boolean; recipeBase: Record<string, string>; lastSyncedAt?: string };
type Store = Pick<Storage, 'getItem' | 'setItem'>;
export interface ComposerCloud {
  read(userId: string): Promise<{ revision: number; payload: ComposerDocument } | null>;
  compareAndSet(userId: string, revision: number, payload: ComposerDocument): Promise<boolean>;
}
export function canonical(value: unknown): string {
  const ordered = (input: unknown): unknown => Array.isArray(input) ? input.map(ordered) : input && typeof input === 'object' ? Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, ordered(v)])) : input;
  return JSON.stringify(ordered(value));
}
async function digest(value: unknown) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return [...new Uint8Array(hash)].map(n => n.toString(16).padStart(2, '0')).join('');
}
export function validateComposerDocument(input: unknown): ComposerDocument {
  const value = input as ComposerDocument;
  if (!value || value.version !== COMPOSER_VERSION || !Array.isArray(value.compositions) || !Array.isArray(value.sessions) || value.compositions.length > 5000 || value.sessions.length > 5000 || new TextEncoder().encode(JSON.stringify(value)).length > 5_000_000) throw new Error('El respaldo del compositor no es válido o supera 5 MB / 5000 registros por grupo.');
  const source = { getItem: (key: string) => JSON.stringify(key === COMPOSER_RECIPES_KEY ? value.compositions : value.sessions), setItem() {} };
  const compositions = readCompositions(source), sessions = readComposerSessions(source);
  if (new Set(compositions.map(row => row.id)).size !== compositions.length || new Set(sessions.map(row => row.id)).size !== sessions.length) throw new Error('El respaldo contiene identificadores repetidos.');
  return { version: COMPOSER_VERSION, compositions, sessions };
}
export function localComposerDocument(store: Store): ComposerDocument {
  return validateComposerDocument({ version: COMPOSER_VERSION, compositions: readCompositions(store), sessions: readComposerSessions(store) });
}
export function readSyncBinding(store: Store): SyncBinding | null {
  const raw = store.getItem(COMPOSER_SYNC_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as SyncBinding;
    if (!value || typeof value.userId !== 'string' || !value.userId || typeof value.enabled !== 'boolean' || !value.recipeBase || typeof value.recipeBase !== 'object' || Array.isArray(value.recipeBase) || !Object.values(value.recipeBase).every(v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)) || (value.lastSyncedAt !== undefined && !Number.isFinite(Date.parse(value.lastSyncedAt)))) throw new Error();
    return value;
  } catch { throw new Error('La vinculación de este navegador no se pudo leer. Tus datos locales se conservan; descarga un respaldo antes de continuar.'); }
}
export function bindComposer(store: Store, userId: string, enabled = true) {
  const existing = readSyncBinding(store);
  if (existing && existing.userId !== userId) throw new Error('Este navegador conserva datos vinculados a otra cuenta. Entra con esa cuenta o usa un perfil de navegador separado.');
  const next = { userId, enabled, recipeBase: existing?.recipeBase ?? {}, ...(existing?.lastSyncedAt ? { lastSyncedAt: existing.lastSyncedAt } : {}) };
  store.setItem(COMPOSER_SYNC_KEY, JSON.stringify(next)); return next;
}

/** Conservative three-way recipe merge. Concurrent edits and changed observations
 * survive as deterministic copies; retries cannot multiply those copies.
 */
export async function mergeComposerDocuments(local: ComposerDocument, remote: ComposerDocument, base: Record<string, string> = {}) {
  validateComposerDocument(local); validateComposerDocument(remote);
  const recipes = new Map(remote.compositions.map(row => [row.id, structuredClone(row)]));
  const sessionRows = new Map(remote.sessions.map(row => [row.id, structuredClone(row)]));
  let conflicts = 0;
  for (const row of local.compositions) {
    const prior = recipes.get(row.id);
    if (!prior) { recipes.set(row.id, structuredClone(row)); continue; }
    if (canonical(prior.recipe) === canonical(row.recipe)) continue;
    const [localHash, remoteHash] = await Promise.all([digest(row), digest(prior)]);
    if (base[row.id] === remoteHash) { recipes.set(row.id, structuredClone(row)); continue; }
    if (base[row.id] === localHash) continue;
    const id = `conflict-recipe-${localHash}`, copy = { ...structuredClone(row), id, recipe: { ...structuredClone(row.recipe), name: `${row.recipe.name.slice(0, 97)} · versión conservada` } };
    if (recipes.has(id) && canonical(recipes.get(id)?.recipe) !== canonical(copy.recipe)) throw new Error('Hay una copia de receta en conflicto. Exporta tus datos para revisarla.');
    if (!recipes.has(id)) { recipes.set(id, copy); conflicts++; }
  }
  for (const row of local.sessions) {
    const prior = sessionRows.get(row.id);
    if (!prior) { sessionRows.set(row.id, structuredClone(row)); continue; }
    const { actionFollowUps: localUpdates = [], ...localCore } = row;
    const { actionFollowUps: remoteUpdates = [], ...remoteCore } = prior;
    if (canonical(localCore) !== canonical(remoteCore)) {
      const id = `conflict-session-${await digest(row)}`;
      if (!sessionRows.has(id)) { sessionRows.set(id, { ...structuredClone(row), id }); conflicts++; }
      continue;
    }
    const updates = new Map(remoteUpdates.map(update => [update.id, update]));
    for (const update of localUpdates) {
      const previous = updates.get(update.id);
      if (previous && canonical(previous) !== canonical(update)) {
        const id = `conflict-followup-${await digest(update)}`;
        if (!updates.has(id)) { updates.set(id, { ...update, id }); conflicts++; }
      } else updates.set(update.id, update);
    }
    sessionRows.set(row.id, { ...prior, ...(updates.size ? { actionFollowUps: [...updates.values()].sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt) || a.id.localeCompare(b.id)) } : {}) });
  }
  const document = validateComposerDocument({ version: COMPOSER_VERSION, compositions: [...recipes.values()].sort((a, b) => a.id.localeCompare(b.id)), sessions: [...sessionRows.values()].sort((a, b) => a.id.localeCompare(b.id)) });
  return { document, conflicts };
}

/** CAS prevents lost writes between devices. A successful cloud write precedes local
 * replacement; if local storage fails, the cloud copy is recoverable and no success
 * acknowledgement is stored. Local edits during awaits cause another merge pass.
 */
export async function synchronizeComposer(store: Store, cloud: ComposerCloud, userId: string, isCurrent = () => true) {
  let conflicts = 0;
  const assertCurrent = () => {
    const binding = readSyncBinding(store);
    if (!isCurrent() || !binding?.enabled || binding.userId !== userId) throw new Error('La sincronización se pausó o cambió la cuenta.');
    return binding;
  };
  for (let attempt = 0; attempt < 4; attempt++) {
    const binding = assertCurrent(), local = localComposerDocument(store), before = canonical(local);
    const remote = await cloud.read(userId); assertCurrent();
    const merged = await mergeComposerDocuments(local, remote?.payload ?? { version: COMPOSER_VERSION, compositions: [], sessions: [] }, binding.recipeBase); assertCurrent();
    if (canonical(localComposerDocument(store)) !== before) continue;
    const changed = !remote || canonical(remote.payload) !== canonical(merged.document);
    if (changed && !await cloud.compareAndSet(userId, remote?.revision ?? 0, merged.document)) continue;
    assertCurrent(); conflicts += merged.conflicts;
    if (canonical(localComposerDocument(store)) !== before) continue;
    // These writes are intentionally separate. On failure the validated merged
    // document remains in the cloud; a retry only adds/preserves existing records.
    if (canonical(local.compositions) !== canonical(merged.document.compositions)) store.setItem(COMPOSER_RECIPES_KEY, JSON.stringify(merged.document.compositions));
    if (canonical(local.sessions) !== canonical(merged.document.sessions)) store.setItem(COMPOSER_SESSIONS_KEY, JSON.stringify(merged.document.sessions));
    const recipeBase = Object.fromEntries(await Promise.all(merged.document.compositions.map(async row => [row.id, await digest(row)])));
    assertCurrent();
    if (canonical(localComposerDocument(store)) !== canonical(merged.document)) continue;
    const lastSyncedAt = new Date().toISOString();
    store.setItem(COMPOSER_SYNC_KEY, JSON.stringify({ ...binding, recipeBase, lastSyncedAt }));
    return { lastSyncedAt, conflicts, document: merged.document };
  }
  throw new Error('Hay cambios simultáneos. Tus datos se conservan; vuelve a sincronizar en unos segundos.');
}
