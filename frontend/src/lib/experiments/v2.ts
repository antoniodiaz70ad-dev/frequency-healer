import type { ExperimentInput, ExperimentRecordV1, ExperimentStatus } from './types';
import { validateExperiment, transitionExperiment } from './validation';
import { validateConstellation, type HarmonicConstellationV1 } from '../harmonic/constellations';
import { planConstellationPlayback } from '../harmonic/constellationPlayback';
import type { HarmonicConfig } from '../harmonic/math';

export interface ConstellationExperimentLinkV2 {
  readonly id: string;
  readonly signature: string;
  readonly generationVersion: HarmonicConstellationV1['generationVersion'];
  readonly snapshot: HarmonicConstellationV1;
}
export interface ExperimentRecordV2 extends Omit<ExperimentRecordV1, 'schemaVersion'> {
  readonly schemaVersion: 2;
  readonly constellation?: ConstellationExperimentLinkV2;
}
export type AuditableExperiment = ExperimentRecordV1 | ExperimentRecordV2;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Experimento V2 inválido.');
  return value as Record<string, unknown>;
}
function asV1(record: ExperimentRecordV2): ExperimentRecordV1 {
  const { constellation, ...base } = record; void constellation;
  return validateExperiment({ ...base, schemaVersion: 1 });
}
/** Version dispatch does not convert legacy records or consult source storage. */
export async function validateAuditableExperiment(value: unknown): Promise<AuditableExperiment> {
  return object(value).schemaVersion === 2 ? validateExperimentV2(value) : validateExperiment(value);
}
export async function validateExperimentV2(value: unknown): Promise<ExperimentRecordV2> {
  // Capture all input before the first Web Crypto await. Caller mutations cannot
  // alter identity, subjective fields or engine configuration during validation.
  const v = object(structuredClone(value));
  if (v.schemaVersion !== 2) throw new Error('Se requiere un registro V2 explícito; no se migran registros V1.');
  const { constellation, ...base } = v;
  // Reuse the unchanged V1 field/lifecycle validators, not its persisted schema.
  const common = validateExperiment({ ...base, schemaVersion: 1 });
  if (constellation === undefined) return Object.freeze({ ...common, schemaVersion: 2 });
  const link = object(constellation);
  if (Object.keys(link).some(key => !['id', 'signature', 'generationVersion', 'snapshot'].includes(key))) throw new Error('Referencia de constelación desconocida.');
  const snapshot = await validateConstellation(link.snapshot);
  if (link.id !== snapshot.id || link.signature !== snapshot.signature || link.generationVersion !== snapshot.generationVersion) throw new Error('Identidad, firma o generación no coinciden con el snapshot de constelación.');
  const config = { ...common.configurationSnapshot, ...(common.configurationSnapshot.progression ? { progression: [...common.configurationSnapshot.progression] } : {}) } as HarmonicConfig;
  const plan = await planConstellationPlayback(snapshot, config);
  const fields = ['baseHz','ratioId','increments','direction','mode','durationSeconds','uiVolume','waveform'] as const;
  if (fields.some(key => plan.config[key] !== config[key]) || JSON.stringify(plan.config.progression) !== JSON.stringify(config.progression)) throw new Error('El snapshot acústico no corresponde exactamente al plan de la constelación.');
  return Object.freeze({ ...common, schemaVersion: 2, constellation: Object.freeze({ id: snapshot.id, signature: snapshot.signature, generationVersion: snapshot.generationVersion, snapshot }) });
}
export function prepareExperimentV2(config: HarmonicConfig, input: ExperimentInput, constellation?: HarmonicConstellationV1, id: string = crypto.randomUUID(), createdAt = new Date().toISOString()) {
  return validateExperimentV2({ ...input, id, schemaVersion: 2, source: 'harmonic-lab', status: 'prepared', createdAt, configurationSnapshot: config, postState: {}, ...(constellation ? { constellation: { id: constellation.id, signature: constellation.signature, generationVersion: constellation.generationVersion, snapshot: constellation } } : {}) });
}
/** Lifecycle only, on an already validated immutable V2. Saving revalidates all audit data. */
export function transitionExperimentV2(record: ExperimentRecordV2, next: Exclude<ExperimentStatus, 'prepared'>, at?: string): ExperimentRecordV2 {
  const base = asV1(record), transitioned = transitionExperiment(base, next, at);
  if (transitioned === base) return record;
  return Object.freeze({ ...transitioned, schemaVersion: 2, ...(record.constellation ? { constellation: record.constellation } : {}) });
}
