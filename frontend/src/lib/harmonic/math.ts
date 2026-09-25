export const RATIOS = {
  root: { p: 1, q: 1, label: 'Raíz' },
  fifth: { p: 3, q: 2, label: 'Quinta justa' },
  fourth: { p: 4, q: 3, label: 'Cuarta justa' },
  'major-third': { p: 5, q: 4, label: 'Tercera mayor' },
  'minor-third': { p: 6, q: 5, label: 'Tercera menor' },
  'cascade-13-12': { p: 13, q: 12, label: 'Cascada experimental' },
} as const;
export type RatioId = keyof typeof RATIOS;
export type Direction = 'ascending' | 'descending' | 'return';
export interface HarmonicConfig {
  baseHz: number;
  ratioId: RatioId;
  increments: number;
  direction: Direction;
  mode: 'sequence' | 'simultaneous';
  durationSeconds: number;
  uiVolume: number;
  waveform: 'sine';
  progression?: RatioId[];
}
export interface HarmonicStep { offsetSeconds: number; durationSeconds: number; frequencies: number[]; ratios: string[] }
export interface HarmonicSchedule { steps: HarmonicStep[]; durationSeconds: number; family: 'intervals' | 'cascade-13-12' }
export function bounded(value: number, min: number, max: number, name: string): number {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${name}: usa un valor entre ${min} y ${max}.`);
  return value;
}
export function frequency(base: number, p: number, q: number): number {
  bounded(base, 40, 2000, 'Base');
  if (!Number.isFinite(p) || !Number.isFinite(q) || p <= 0 || q <= 0) throw new Error('Relación inválida.');
  return bounded(base * p / q, 40, 2000, 'Frecuencia derivada');
}
export function cascade(base: number, n: number, direction: Direction): number[] {
  bounded(base, 40, 2000, 'Base');
  if (!Number.isInteger(n) || n < 1 || n > 8) throw new Error('Incrementos: entero de 1 a 8.');
  if (!['ascending', 'descending', 'return'].includes(direction)) throw new Error('Trayectoria inválida.');
  const exponents = Array.from({ length: n + 1 }, (_, k) => direction === 'descending' ? -k : k);
  if (direction === 'return') exponents.push(...Array.from({ length: n }, (_, k) => n - 1 - k));
  return exponents.map(k => bounded(base * (13 / 12) ** k, 40, 2000, 'Frecuencia derivada'));
}
export function masterGain(volume: number) { return 0.25 * bounded(volume, 0, 100, 'Volumen') / 100; }
export function voiceGain(n: number) {
  if (!Number.isInteger(n) || n < 1 || n > 9) throw new Error('Máximo 9 voces simultáneas.');
  return 1 / n;
}
export function buildSchedule(config: HarmonicConfig): HarmonicSchedule {
  bounded(config.baseHz, 40, 2000, 'Base');
  bounded(config.durationSeconds, 1, 3600, 'Duración');
  masterGain(config.uiVolume);
  if (config.waveform !== 'sine' || !['sequence', 'simultaneous'].includes(config.mode)) throw new Error('Modo u onda inválidos.');
  if (!Object.hasOwn(RATIOS, config.ratioId)) throw new Error('Relación desconocida.');
  if (!Number.isInteger(config.increments) || config.increments < 1 || config.increments > 8) throw new Error('Incrementos inválidos.');
  if (!['ascending', 'descending', 'return'].includes(config.direction)) throw new Error('Trayectoria inválida.');
  let hz: number[]; let labels: string[];
  if (config.ratioId === 'cascade-13-12') {
    if (config.progression) throw new Error('La cascada no acepta una progresión adicional.');
    hz = cascade(config.baseHz, config.increments, config.direction);
    labels = hz.map((_, i) => {
      const k = config.direction === 'descending' ? -i : i <= config.increments ? i : 2 * config.increments - i;
      return `(13/12)^${k}`;
    });
  } else {
    const ids = config.progression ?? ['root', config.ratioId];
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 9 || ids.some(id => !Object.hasOwn(RATIOS, id) || id === 'cascade-13-12')) throw new Error('Progresión inválida.');
    hz = ids.map(id => frequency(config.baseHz, RATIOS[id].p, RATIOS[id].q));
    labels = ids.map(id => `${RATIOS[id].p}:${RATIOS[id].q}`);
  }
  if (config.mode === 'simultaneous') voiceGain(hz.length);
  const duration = config.durationSeconds;
  const steps = config.mode === 'simultaneous'
    ? [{ offsetSeconds: 0, durationSeconds: duration, frequencies: hz, ratios: labels }]
    : hz.map((f, i) => ({ offsetSeconds: i * duration / hz.length, durationSeconds: duration / hz.length, frequencies: [f], ratios: [labels[i]] }));
  if (steps.some(step => step.durationSeconds < 0.06)) throw new Error('Duración insuficiente para las rampas.');
  return { steps, durationSeconds: duration, family: config.ratioId === 'cascade-13-12' ? 'cascade-13-12' : 'intervals' };
}
