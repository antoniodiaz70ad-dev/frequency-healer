import { GEOMETRY_VERSION, validateGeometry, validatePhaseMinutes, type GeometryConfig } from './geometry';

export const GEOMETRY_JOURNAL_KEY = 'fh:cymatics-intention-v1';
export type Emotion = { valence: number; activation: number; clarity: number };
export type GeometryRecord = {
  version: typeof GEOMETRY_VERSION; id: string; startedAt: string; endedAt: string;
  status: 'completed' | 'stopped'; elapsedMs: number; config: GeometryConfig;
  phaseMinutes: [number, number, number, number]; soundEnabled: boolean; volume: number;
  volumeChanges: { elapsedMs: number; volume: number }[];
  before: Emotion; after: Emotion;
  intention: string; thought: string; decision: string; action: string; observation: string;
  followUps: { at: string; text: string }[];
};
type Store = Pick<Storage, 'getItem' | 'setItem'>;
type Lock = <T>(operation: () => T | Promise<T>) => Promise<T>;
const browserLock: Lock = async operation => {
  if (typeof navigator === 'undefined' || !navigator.locks) throw new Error('Este navegador no permite guardar con bloqueo entre pestañas. Puedes exportar tu registro.');
  return navigator.locks.request(GEOMETRY_JOURNAL_KEY, operation);
};
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const date = (s: unknown): s is string => typeof s === 'string' && s.length <= 40 && Number.isFinite(Date.parse(s));
const text = (s: unknown): s is string => typeof s === 'string' && s.length <= 4000;
const number = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
function stable(value: unknown): string {
  if(Array.isArray(value))return `[${value.map(stable).join(',')}]`;
  if(isObject(value))return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function validateEmotion(v: unknown): Emotion {
  if (!isObject(v) || Object.keys(v).length !== 3 || !number(v.valence, -5, 5) || !number(v.activation, 0, 10) || !number(v.clarity, 0, 10)) throw new Error('Registro emocional inválido.');
  return { valence: v.valence as number, activation: v.activation as number, clarity: v.clarity as number };
}
export function validateGeometryRecord(v: unknown): GeometryRecord {
  const keys = ['version','id','startedAt','endedAt','status','elapsedMs','config','phaseMinutes','soundEnabled','volume','volumeChanges','before','after','intention','thought','decision','action','observation','followUps'];
  if (!isObject(v) || Object.keys(v).length !== keys.length || !keys.every(k => k in v) || v.version !== GEOMETRY_VERSION || typeof v.id !== 'string' || !v.id || v.id.length > 100 || !date(v.startedAt) || !date(v.endedAt) || Date.parse(v.endedAt) < Date.parse(v.startedAt) || !['completed','stopped'].includes(String(v.status)) || typeof v.soundEnabled !== 'boolean' || !number(v.volume, 0, .6) || !['intention','thought','decision','action','observation'].every(k => text(v[k]))) throw new Error('El diario geométrico tiene un formato diferente; se conservó el original.');
  const phaseMinutes = validatePhaseMinutes(v.phaseMinutes), total = phaseMinutes.reduce((a,b) => a+b,0) * 60000;
  if (!Array.isArray(v.volumeChanges) || v.volumeChanges.length > 2000 || !v.volumeChanges.every((c,i,all) => isObject(c) && Object.keys(c).length === 2 && number(c.elapsedMs,0,typeof v.elapsedMs==='number'?v.elapsedMs:0) && number(c.volume,0,.6) && (!i || c.elapsedMs >= all[i-1].elapsedMs))) throw new Error('Los cambios de volumen no son válidos.');
  if (!number(v.elapsedMs, 0, total) || v.status === 'completed' && v.elapsedMs !== total || !Array.isArray(v.followUps) || v.followUps.length > 100 || !v.followUps.every(f => isObject(f) && Object.keys(f).length === 2 && date(f.at) && Date.parse(f.at) >= Date.parse(v.endedAt as string) && text(f.text) && f.text.trim())) throw new Error('La duración o las observaciones del registro no son válidas.');
  return structuredClone({ ...v, config: validateGeometry(v.config), phaseMinutes, before: validateEmotion(v.before), after: validateEmotion(v.after) }) as GeometryRecord;
}
export function parseGeometryJournal(raw: string | null): GeometryRecord[] {
  if (raw === null) return [];
  if (raw.length > 5_000_000 || new TextEncoder().encode(raw).byteLength > 5_000_000) throw new Error('El diario supera 5 MB; se conservó el original.');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('El diario está dañado; se conservó el original. Exporta el archivo para recuperarlo.'); }
  if (!Array.isArray(value) || value.length > 300) throw new Error('El diario admite hasta 300 registros; se conservó el original.');
  const rows = value.map(validateGeometryRecord);
  if (new Set(rows.map(r => r.id)).size !== rows.length) throw new Error('El diario contiene identificadores duplicados.');
  return rows;
}
export const readGeometryJournal = (store: Pick<Storage, 'getItem'>) => parseGeometryJournal(store.getItem(GEOMETRY_JOURNAL_KEY));
function persist(rows: GeometryRecord[], store: Store) {
  const raw=JSON.stringify(rows);
  if(raw.length>5_000_000||new TextEncoder().encode(raw).byteLength>5_000_000)throw new Error('El diario superaría 5 MB. Exporta tu borrador.');
  try{store.setItem(GEOMETRY_JOURNAL_KEY,raw);}catch{throw new Error('No hay espacio o permiso para guardar. Exporta tu borrador; el diario anterior se conserva.');}
  return rows;
}
export async function saveGeometryRecord(record: GeometryRecord, store: Store, lock: Lock = browserLock) {
  const valid = validateGeometryRecord(record);
  return lock(() => {
    const rows = readGeometryJournal(store), found = rows.find(r => r.id === valid.id);
    if (found) { if (stable(found) !== stable(valid)) throw new Error('El registro ya existe con otro contenido; no se sobrescribió.'); return rows; }
    if (rows.length >= 300) throw new Error('El diario está lleno; exporta tus registros.');
    return persist([...rows, valid],store);
  });
}
export async function importGeometryJournal(raw: string, store: Store, lock: Lock = browserLock) {
  const incoming = parseGeometryJournal(raw);
  return lock(() => {
    const rows = readGeometryJournal(store), known = new Map(rows.map(r => [r.id, r]));
    for (const row of incoming) { const found = known.get(row.id); if (found && stable(found) !== stable(row)) throw new Error('Hay un registro con el mismo identificador y contenido diferente; no se importó nada.'); known.set(row.id, row); }
    const next = [...known.values()]; if (next.length > 300) throw new Error('La importación superaría los 300 registros.');
    return persist(next,store);
  });
}
export async function addGeometryFollowUp(id: string, followUp: { at: string; text: string }, store: Store, lock: Lock = browserLock) {
  return lock(() => {
    const rows = readGeometryJournal(store), index = rows.findIndex(r => r.id === id);
    if (index < 0) throw new Error('La sesión ya no está en este diario.');
    const row = rows[index];
    if (row.followUps.some(f => f.at === followUp.at && f.text === followUp.text)) return rows;
    rows[index] = validateGeometryRecord({ ...row, followUps: [...row.followUps, followUp] });
    return persist(rows,store);
  });
}
