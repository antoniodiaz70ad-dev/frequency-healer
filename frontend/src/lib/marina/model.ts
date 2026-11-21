/** Source descriptions are attributed to Jacobi; playback recipes are our adaptations. */
export const MARINA_VERSION = 'marina-exploration-1';
export const MARINA_STORAGE_KEY = 'fh.marina.sessions.v1';
export const MARINA_SOURCES = {
  reactor: 'https://marinajacobi.com/wp-content/uploads/2022/10/The-Harmonic-Reactor-Corrections-11-19-21-1-1.pdf',
  scientific: 'https://marinajacobi.com/wp-content/uploads/2022/10/The-Scientific-Download-by-Marina-Jacobi.pdf',
};
export const MARINA_FREQUENCIES = [
  { hz: 1, name: 'Campo', description: 'Marina escribe «campo igual/sin campo»; el pasaje es ambiguo.' },
  { hz: 2, name: 'Apertura', description: 'Apertura, según el mapa de Marina.' },
  { hz: 3, name: 'Preparación', description: 'Preparación y base para los campos, según Marina.' },
  { hz: 4, name: 'Centro', description: 'Concentración en el centro, según Marina.' },
  { hz: 5, name: 'Neutralidad', description: 'Neutralidad y combinación de tonos o pulsos, según Marina.' },
  { hz: 6, name: 'Localización', description: 'Localización de aperturas o campos, según Marina.' },
  { hz: 7, name: 'Exploración', description: 'Marina describe varios campos y una combinación con «200+ Hz», sin fijar un par binaural.' },
  { hz: 8, name: 'Estabilización', description: 'Estabilización, según el mapa de Marina.' },
  { hz: 9, name: 'Unificación', description: 'El número 9 unifica en su explicación cosmológica; no define una receta auditiva.' },
  { hz: 28, name: 'Apertura y estabilidad', description: 'Marina interpreta los dígitos 2 y 8 como apertura y estabilización.' },
] as const;
export type MarinaMode = 'pulse' | 'binaural' | 'direct' | 'silence';
export type MarinaAudioConfig = { mode: MarinaMode; hz: number; carrierHz: number };
export const DEFAULT_MARINA_CONFIG: MarinaAudioConfig = { mode: 'pulse', hz: 3, carrierHz: 200 };
export function validateMarinaAudio(config: MarinaAudioConfig, sampleRate = 48000): void {
  if (!['pulse', 'binaural', 'direct', 'silence'].includes(config.mode)) throw new Error('Elige un modo de audio disponible.');
  if (config.mode === 'silence') return;
  const values = [config.hz, config.carrierHz, sampleRate];
  if (!values.every(Number.isFinite) || config.hz <= 0 || config.carrierHz <= 0 || sampleRate <= 0) throw new Error('Introduce frecuencias positivas y finitas.');
  if (config.mode !== 'direct' && config.carrierHz < 20) throw new Error('Para pulso o binaural, elige una portadora audible de al menos 20 Hz.');
  const highest = config.mode === 'direct' ? config.hz : config.carrierHz + config.hz;
  if (highest >= sampleRate / 2) throw new Error('Esta frecuencia supera lo que el motor de audio puede representar.');
}
export function marinaAudioLabel(config: MarinaAudioConfig): string {
  if (config.mode === 'silence') return 'Silencio';
  if (config.mode === 'direct') return `Tono directo · ${config.hz} Hz`;
  if (config.mode === 'binaural') return `Izquierda ${config.carrierHz} Hz · derecha ${config.carrierHz + config.hz} Hz · diferencia ${config.hz} Hz`;
  return `Portadora ${config.carrierHz} Hz · pulso sinusoidal ${config.hz} Hz`;
}
export const MARINA_PHASES = [
  { id: 'zero', name: 'Punto cero', seconds: 240, hz: 3, mode: 'pulse', guide: 'Siente el apoyo del cuerpo. Respira con naturalidad. Observa tu experiencia y permite que la reacción se aquiete.' },
  { id: 'emotion', name: 'Emoción', seconds: 180, hz: 3, mode: 'pulse', guide: 'Evoca una experiencia de alegría, amor o gratitud. Observa cómo se siente en ti. Dale espacio antes de construir la imagen.' },
  { id: 'blueprint', name: 'Tu blueprint', seconds: 480, hz: 7, mode: 'binaural', guide: 'Construye la escena que deseas explorar. Añade entorno, sensaciones y relaciones. Mantén la emoción mientras desarrollas sus detalles.' },
  { id: 'intensify', name: 'Profundizar', seconds: 240, hz: 7, mode: 'binaural', guide: 'Profundiza en la emoción y la escena de una manera cómoda. Observa qué cambia. Puedes permanecer simplemente con la imagen.' },
  { id: 'hold', name: 'Sostener', seconds: 120, hz: 8, mode: 'pulse', guide: 'Sostén la escena y el sentimiento. Permite una estabilidad cómoda. Advierte sensaciones, imágenes o ideas sin apresurarte a explicarlas.' },
  { id: 'release', name: 'Soltar', seconds: 180, hz: 0, mode: 'silence', guide: 'Deja caer la imagen. Respira y vuelve al entorno. Conserva lo que quieras registrar y elige cómo llevar tu intención al día.' },
] as const;
export const MARINA_TOTAL_MS = MARINA_PHASES.reduce((sum, phase) => sum + phase.seconds * 1000, 0);
export function marinaPhaseAt(elapsedMs: number) {
  if (elapsedMs >= MARINA_TOTAL_MS) return null;
  let startMs = 0;
  for (const phase of MARINA_PHASES) {
    const endMs = startMs + phase.seconds * 1000;
    if (elapsedMs < endMs) return { ...phase, startMs, endMs };
    startMs = endMs;
  }
  return null;
}
/** Monotonic active-time clock; pauses never consume a phase. */
export class MarinaClock {
  elapsedMs = 0;
  private last: number | null = null;
  constructor(readonly durationMs: number) {}
  resume(now: number) { this.last = now; }
  tick(now: number) {
    if (this.last !== null) {
      this.elapsedMs = Math.min(this.durationMs, this.elapsedMs + Math.max(0, now - this.last));
      this.last = now;
    }
    return this.elapsedMs;
  }
  pause(now: number) { this.tick(now); this.last = null; }
}
export type MarinaNotes = { intention: string; experience: string; interpretation: string; events: string; action: string };
export type MarinaRecord = {
  id: string; version: typeof MARINA_VERSION; startedAt: string; endedAt: string;
  kind: 'guided' | 'free'; status: 'completed' | 'stopped'; elapsedMs: number;
  config: MarinaAudioConfig; soundEnabled: boolean; notes: MarinaNotes;
};
export interface MarinaStore { getItem(key: string): string | null; setItem(key: string, value: string): void }
export function isMarinaRecord(value: unknown): value is MarinaRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as MarinaRecord;
  try {
    if (!r.config) return false;
    validateMarinaAudio(r.config);
    return typeof r.id === 'string' && r.id.length > 0 && r.version === MARINA_VERSION &&
      ['guided', 'free'].includes(r.kind) && ['completed', 'stopped'].includes(r.status) &&
      Number.isFinite(r.elapsedMs) && r.elapsedMs >= 0 && typeof r.soundEnabled === 'boolean' &&
      typeof r.startedAt === 'string' && Number.isFinite(Date.parse(r.startedAt)) &&
      typeof r.endedAt === 'string' && Number.isFinite(Date.parse(r.endedAt)) && !!r.notes &&
      ['intention', 'experience', 'interpretation', 'events', 'action'].every(key => typeof r.notes[key as keyof MarinaNotes] === 'string');
  } catch { return false; }
}
export function readMarinaRecords(store: MarinaStore): MarinaRecord[] {
  const raw = store.getItem(MARINA_STORAGE_KEY);
  if (!raw) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error('El diario contiene datos que no se pudieron leer. Se conservó el original; puedes exportarlo.'); }
  if (!Array.isArray(parsed) || !parsed.every(isMarinaRecord)) throw new Error('El diario tiene un formato diferente. Se conservó el original; puedes exportarlo.');
  return parsed;
}
export function saveMarinaRecord(store: MarinaStore, record: MarinaRecord): MarinaRecord[] {
  if (!isMarinaRecord(record)) throw new Error('La sesión no tiene un formato válido.');
  const records = readMarinaRecords(store);
  const next = [...records.filter(r => r.id !== record.id), record];
  store.setItem(MARINA_STORAGE_KEY, JSON.stringify(next));
  return next;
}
