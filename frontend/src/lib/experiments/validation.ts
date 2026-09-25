import { buildSchedule, type HarmonicConfig } from '../harmonic/math';
import { STATE_FIELDS, type ConfigurationSnapshot, type ExperimentInput, type ExperimentRecordV1, type ExperimentState, type ExperimentStatus } from './types';

function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new Error('Registro de experimento inválido: estructura desconocida.');
  return value as Record<string, unknown>;
}
function text(value: unknown, limit: number, empty = true): string {
  if (typeof value !== 'string' || value.length > limit || (!empty && !value.trim())) throw new Error('Texto de experimento inválido.');
  return value;
}
function date(value: unknown): string {
  const result = text(value, 24, false);
  if (!Number.isFinite(Date.parse(result)) || new Date(result).toISOString() !== result) throw new Error('Fecha de experimento inválida.');
  return result;
}
function score(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10) throw new Error('Escala inválida: usa un número de 0 a 10 u omite el campo.');
  return value;
}
export function validateState(value: unknown): ExperimentState {
  const input = object(value, STATE_FIELDS);
  const result: Partial<Record<typeof STATE_FIELDS[number], number>> = {};
  for (const field of STATE_FIELDS) if (Object.hasOwn(input, field)) result[field] = score(input[field]);
  return Object.freeze(result);
}
function snapshot(value: unknown): ConfigurationSnapshot {
  const input = object(value, ['baseHz', 'ratioId', 'increments', 'direction', 'mode', 'durationSeconds', 'uiVolume', 'waveform', 'progression']);
  // The existing compiler is the authority for all acoustic limits and IDs.
  const config = { ...input, ...(input.progression === undefined ? {} : { progression: Array.isArray(input.progression) ? [...input.progression] : input.progression }) } as unknown as HarmonicConfig;
  buildSchedule(config);
  if (config.progression) Object.freeze(config.progression);
  return Object.freeze(config);
}
export function validateExperiment(value: unknown): ExperimentRecordV1 {
  const v = object(value, ['id', 'schemaVersion', 'createdAt', 'startedAt', 'endedAt', 'completedAt', 'source', 'status', 'intention', 'expectationScore', 'context', 'configurationSnapshot', 'preState', 'postState', 'reflection']);
  const statuses: readonly unknown[] = ['prepared', 'started', 'completed', 'cancelled', 'interrupted'];
  if (v.schemaVersion !== 1 || v.source !== 'harmonic-lab' || !statuses.includes(v.status)) throw new Error('Versión, origen o estado de experimento inválido.');
  const createdAt = date(v.createdAt);
  const startedAt = v.startedAt === undefined ? undefined : date(v.startedAt);
  const endedAt = v.endedAt === undefined ? undefined : date(v.endedAt);
  const completedAt = v.completedAt === undefined ? undefined : date(v.completedAt);
  const status = v.status as ExperimentStatus;
  const terminal = status === 'completed' || status === 'cancelled' || status === 'interrupted';
  if ((status === 'prepared' && (startedAt || endedAt || completedAt)) ||
      (status !== 'prepared' && !startedAt) ||
      (status === 'started' && (endedAt || completedAt)) ||
      (terminal && !endedAt) ||
      (status === 'completed' ? completedAt !== endedAt : completedAt !== undefined) ||
      (startedAt && startedAt < createdAt) || (endedAt && startedAt && endedAt < startedAt)) throw new Error('Cronología de experimento inválida.');
  return Object.freeze({
    id: text(v.id, 100, false), schemaVersion: 1, source: 'harmonic-lab', status, createdAt,
    ...(startedAt === undefined ? {} : { startedAt }), ...(endedAt === undefined ? {} : { endedAt }), ...(completedAt === undefined ? {} : { completedAt }),
    ...(v.intention === undefined ? {} : { intention: text(v.intention, 500) }),
    ...(v.context === undefined ? {} : { context: text(v.context, 1000) }),
    ...(v.expectationScore === undefined ? {} : { expectationScore: score(v.expectationScore) }),
    configurationSnapshot: snapshot(v.configurationSnapshot), preState: validateState(v.preState), postState: validateState(v.postState),
    ...(v.reflection === undefined ? {} : { reflection: text(v.reflection, 2000) }),
  });
}
export function prepareExperiment(config: HarmonicConfig, input: ExperimentInput, id: string = crypto.randomUUID(), createdAt = new Date().toISOString()): ExperimentRecordV1 {
  return validateExperiment({ ...input, id, schemaVersion: 1, source: 'harmonic-lab', status: 'prepared', createdAt, configurationSnapshot: config, postState: {} });
}
export function transitionExperiment(record: ExperimentRecordV1, next: Exclude<ExperimentStatus, 'prepared'>, at = new Date(Math.max(Date.now(), Date.parse(record.startedAt ?? record.createdAt))).toISOString()): ExperimentRecordV1 {
  // A delayed callback must never relabel a stopped/interrupted experiment.
  if (['completed', 'cancelled', 'interrupted'].includes(record.status) || record.status === next) return record;
  if (record.status === 'prepared') {
    if (next === 'cancelled' || next === 'interrupted') return record; // Playback never began.
    if (next !== 'started') throw new Error('El experimento no comenzó.');
    return validateExperiment({ ...record, status: next, startedAt: at });
  }
  return validateExperiment({ ...record, status: next, endedAt: at, ...(next === 'completed' ? { completedAt: at } : {}) });
}
