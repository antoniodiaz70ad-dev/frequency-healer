import { completedFirePhases, FIRE_TOTAL_MS, fireSchedule } from './protocol';

export const FIRE_STORAGE_KEY = 'rl:prueba-de-fuego:v1';
export type FireMode = 'seated' | 'treadmill';
export type FireLatency = 'immediate' | 'brief' | 'late' | 'unknown';
export interface FireSession {
  id: string;
  startedAt: string;
  endedAt: string;
  day: string;
  exercise: string;
  mode: FireMode;
  elapsedMs: number;
  completedPhases: string[];
  status: 'completed' | 'stopped';
  programStart: string | null;
  distractions: number | null;
  latency: FireLatency;
  recovery: number | null;
  presence: number | null;
  identification: number | null;
  note: string;
}
export interface FireData { schemaVersion: 1; programStart: string | null; sessions: FireSession[] }
export interface FireStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export const emptyFireData = (): FireData => ({ schemaVersion: 1, programStart: null, sessions: [] });
const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Registro inválido.');
  return v as Record<string, unknown>;
};
const timestamp = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const score = (v: unknown) => v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10);
const text = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
export function parseFireData(raw: string): FireData {
  const data = record(JSON.parse(raw));
  if (data.schemaVersion !== 1 || !Array.isArray(data.sessions)) throw new Error('Formato de Prueba de Fuego inválido.');
  if (data.programStart !== null) fireSchedule(String(data.programStart));
  const ids = new Set<string>();
  for (const input of data.sessions) {
    const s = record(input);
    if (typeof s.id !== 'string' || !s.id || ids.has(s.id) || !timestamp(s.startedAt) || !timestamp(s.endedAt) || Date.parse(String(s.endedAt)) < Date.parse(String(s.startedAt)) || !text(s.exercise, 200) || !String(s.exercise).trim() || !text(s.note, 2000) || !['seated', 'treadmill'].includes(String(s.mode)) || !['completed', 'stopped'].includes(String(s.status))) throw new Error('Sesión inválida.');
    fireSchedule(String(s.day));
    if (s.programStart !== null && !fireSchedule(String(s.programStart)).includes(String(s.day))) throw new Error('Sesión fuera del programa.');
    if (typeof s.elapsedMs !== 'number' || !Number.isFinite(s.elapsedMs) || s.elapsedMs < 0 || s.elapsedMs > FIRE_TOTAL_MS || (s.status === 'completed') !== (s.elapsedMs === FIRE_TOTAL_MS)) throw new Error('Duración inválida.');
    if (JSON.stringify(s.completedPhases) !== JSON.stringify(completedFirePhases(s.elapsedMs))) throw new Error('Fases inconsistentes.');
    if (!(s.distractions === null || (typeof s.distractions === 'number' && Number.isSafeInteger(s.distractions) && s.distractions >= 0)) || !['immediate', 'brief', 'late', 'unknown'].includes(String(s.latency)) || !score(s.recovery) || !score(s.presence) || !score(s.identification)) throw new Error('Autorreporte inválido.');
    ids.add(s.id);
  }
  return data as unknown as FireData;
}
export function readFireData(storage: FireStorage): FireData {
  const raw = storage.getItem(FIRE_STORAGE_KEY);
  return raw === null ? emptyFireData() : parseFireData(raw);
}
/** Explicit user actions only. Read again so corrupt data is never overwritten. */
export function saveFireSession(storage: FireStorage, session: FireSession, consent: boolean) {
  if (!consent) throw new Error('Autoriza el guardado local para continuar.');
  const current = readFireData(storage);
  const next = { ...current, sessions: [...current.sessions.filter(s => s.id !== session.id), session] };
  parseFireData(JSON.stringify(next));
  storage.setItem(FIRE_STORAGE_KEY, JSON.stringify(next));
  return next;
}
export function startFireProgram(storage: FireStorage, start: string, consent: boolean) {
  if (!consent) throw new Error('Autoriza el guardado local para continuar.');
  fireSchedule(start);
  const current = readFireData(storage);
  if (current.programStart !== null) throw new Error('El programa ya está iniciado.');
  const next = { ...current, programStart: start };
  storage.setItem(FIRE_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function fireSummary(sessions: FireSession[]) {
  const completed = sessions.filter(s => s.status === 'completed');
  return (['recovery', 'presence', 'identification'] as const).map(key => {
    const values = completed.map(s => s[key]).filter((v): v is number => v !== null);
    return { key, count: values.length, mean: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null };
  });
}
