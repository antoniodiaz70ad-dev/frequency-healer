/** Reproducible acoustic recipes. Source associations are not therapeutic claims. */
export const COMPOSER_VERSION = 'marina-composer-1';
export const COMPOSER_RECIPES_KEY = 'fh.marina.compositions.v1';
export const COMPOSER_SESSIONS_KEY = 'fh.marina.composer-sessions.v1';
export const NANO_SOURCE = 'https://marinajacobi.com/wp-content/uploads/2022/10/Nano-Tech-Final-PDF-7-27-17.pdf';
export const NANO_REFERENCES = [
  { hz: 7.5, label: '7–8 Hz', printedPage: 1, description: 'Intervalo citado como elementos constructivos. 7.5 Hz es nuestro punto de partida dentro de ese intervalo.' },
  { hz: .3879, label: '0.3879 Hz', printedPage: 3, description: 'Citado en una propuesta sobre carbono y nanopartículas.' },
  { hz: .32789, label: '0.32789 Hz', printedPage: 12, description: 'Asociado por Jacobi a un supuesto escudo y estabilización.' },
  { hz: .378394, label: '0.378394 Hz', printedPage: 23, description: 'Asociado por Jacobi a una propuesta de regeneración celular, sin validación experimental en el libro.' },
] as const;

export type ComposerMode = 'tone' | 'pulse' | 'binaural';
export type ComposerLayer = {
  id: string; name: string; enabled: boolean; mode: ComposerMode;
  carrierHz: number; rateHz: number; depth: number; level: number;
};
export type ComposerRecipe = {
  version: typeof COMPOSER_VERSION; name: string; intention: string;
  durationMinutes: number; transitionSeconds: number; visual: boolean;
  layers: ComposerLayer[];
};
export type SavedComposition = { id: string; savedAt: string; recipe: ComposerRecipe };
export type ComposerSession = {
  id: string; startedAt: string; endedAt: string; elapsedMs: number;
  status: 'completed' | 'stopped'; recipe: ComposerRecipe; experience: string;
};
type Store = Pick<Storage, 'getItem' | 'setItem'>;

export function defaultComposition(): ComposerRecipe {
  return { version: COMPOSER_VERSION, name: 'Mi composición', intention: '', durationMinutes: 12, transitionSeconds: 2, visual: true, layers: [
    { id: 'base', name: 'Base pulsada', enabled: true, mode: 'pulse', carrierHz: 200, rateHz: 7.5, depth: .35, level: .6 },
    { id: 'harmony', name: 'Armonía', enabled: false, mode: 'tone', carrierHz: 300, rateHz: 7, depth: .35, level: .25 },
    { id: 'space', name: 'Espacio estéreo', enabled: false, mode: 'binaural', carrierHz: 220, rateHz: 7, depth: .35, level: .25 },
  ] };
}

export function validateComposition(recipe: ComposerRecipe, sampleRate = 48000): void {
  if (!recipe || recipe.version !== COMPOSER_VERSION || typeof recipe.name !== 'string' || !recipe.name.trim() || recipe.name.length > 120 || typeof recipe.intention !== 'string' || recipe.intention.length > 6000 || typeof recipe.visual !== 'boolean') throw new Error('La composición tiene un formato diferente.');
  if (!Number.isFinite(recipe.durationMinutes) || recipe.durationMinutes < 1 || recipe.durationMinutes > 240) throw new Error('Elige una duración entre 1 y 240 minutos.');
  if (!Number.isFinite(recipe.transitionSeconds) || recipe.transitionSeconds < .05 || recipe.transitionSeconds > 10) throw new Error('Elige una transición entre 0.05 y 10 segundos.');
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) throw new Error('La frecuencia de muestreo no es válida.');
  if (!Array.isArray(recipe.layers) || recipe.layers.length < 1 || recipe.layers.length > 3) throw new Error('La composición admite de una a tres capas.');
  const ids = new Set<string>();
  for (const layer of recipe.layers) {
    if (!layer || typeof layer.id !== 'string' || !layer.id || ids.has(layer.id) || typeof layer.name !== 'string' || !layer.name.trim() || layer.name.length > 100 || typeof layer.enabled !== 'boolean' || !['tone', 'pulse', 'binaural'].includes(layer.mode)) throw new Error('Revisa el formato de las capas.');
    ids.add(layer.id);
    if (![layer.carrierHz, layer.rateHz, layer.depth, layer.level].every(Number.isFinite) || layer.carrierHz < 20 || layer.rateHz <= 0 || layer.rateHz > 40 || layer.depth < 0 || layer.depth > 1 || layer.level < 0 || layer.level > 1) throw new Error('Usa una portadora desde 20 Hz, pulsaciones mayores que 0 y hasta 40 Hz y niveles entre 0 y 100 %.');
    const highest = layer.mode === 'tone' ? layer.carrierHz : layer.carrierHz + layer.rateHz;
    if (highest >= sampleRate / 2) throw new Error('Una capa supera lo que este dispositivo puede representar.');
  }
}

/** Unit peak bound even when all carriers happen to align. No loudness claim. */
export function compositionMix(recipe: ComposerRecipe) {
  const layers = recipe.layers.filter(layer => layer.enabled && layer.level > 0);
  const divisor = Math.max(1, layers.reduce((sum, layer) => sum + layer.level, 0));
  return layers.map(layer => ({ ...layer, gain: layer.level / divisor }));
}
export function layerLabel(layer: ComposerLayer) {
  if (layer.mode === 'tone') return `${layer.carrierHz} Hz · tono continuo`;
  if (layer.mode === 'binaural') return `L ${layer.carrierHz} Hz · R ${Number((layer.carrierHz + layer.rateHz).toFixed(6))} Hz · diferencia ${layer.rateHz} Hz`;
  return `${layer.carrierHz} Hz · pulso ${layer.rateHz} Hz · profundidad ${Math.round(layer.depth * 100)} %`;
}

export function readCompositions(store: Store): SavedComposition[] {
  return readArray(store, COMPOSER_RECIPES_KEY, (value): value is SavedComposition => {
    const row = value as SavedComposition;
    try { validateComposition(row.recipe); return typeof row.id === 'string' && !!row.id && validDate(row.savedAt); } catch { return false; }
  });
}
export function saveComposition(store: Store, row: SavedComposition) {
  validateComposition(row.recipe);
  if (!row.id || !validDate(row.savedAt)) throw new Error('La receta no tiene una fecha o identificador válido.');
  const rows = readCompositions(store);
  const next = [...rows.filter(item => item.id !== row.id), row];
  store.setItem(COMPOSER_RECIPES_KEY, JSON.stringify(next));
  return next;
}
function validDate(value: unknown): value is string { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }
export function readComposerSessions(store: Store): ComposerSession[] {
  return readArray(store, COMPOSER_SESSIONS_KEY, (value): value is ComposerSession => {
    const row = value as ComposerSession;
    try {
      validateComposition(row.recipe);
      return typeof row.id === 'string' && !!row.id && validDate(row.startedAt) && validDate(row.endedAt) && ['completed', 'stopped'].includes(row.status) && Number.isFinite(row.elapsedMs) && row.elapsedMs >= 0 && row.elapsedMs <= row.recipe.durationMinutes * 60000 && typeof row.experience === 'string' && row.experience.length <= 6000;
    } catch { return false; }
  });
}
export function saveComposerSession(store: Store, row: ComposerSession) {
  // Validate through the same reader used for persisted and exported records.
  readComposerSessions({ getItem: () => JSON.stringify([row]), setItem: () => {} });
  const rows = readComposerSessions(store);
  const next = [...rows.filter(item => item.id !== row.id), row];
  store.setItem(COMPOSER_SESSIONS_KEY, JSON.stringify(next));
  return next;
}
function readArray<T>(store: Store, key: string, valid: (row: unknown) => row is T): T[] {
  const raw = store.getItem(key);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(valid)) throw new Error();
    return parsed;
  } catch { throw new Error('Los datos guardados del compositor no se pudieron leer. Se conserva el original; expórtalo antes de continuar.'); }
}
