import type { ExperimentRecordV1 } from './types';
import { validateExperiment } from './validation';

export const EXPERIMENTS_KEY = 'fh:experiment-sessions-v1';
export interface ExperimentStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export type ExperimentLock = <T>(operation: () => T | Promise<T>) => Promise<T>;
const browserLock: ExperimentLock = async operation => {
  if (typeof navigator === 'undefined' || !navigator.locks) throw new Error('No hay bloqueo seguro entre pestañas. Exporta el registro sin guardar.');
  return navigator.locks.request(EXPERIMENTS_KEY, () => operation());
};
function parse(raw: string | null): ExperimentRecordV1[] {
  if (raw === null) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) throw new Error();
    const records = value.map(validateExperiment);
    if (new Set(records.map(record => record.id)).size !== records.length) throw new Error();
    return records;
  } catch { throw new Error('Historial de experimentos inválido. No se sobrescribió. Exporta el almacenamiento original.'); }
}
export class ExperimentStore {
  constructor(private storage: ExperimentStorage, private lock: ExperimentLock = browserLock) {}
  load() { return parse(this.storage.getItem(EXPERIMENTS_KEY)); }
  exportJSON() { return JSON.stringify(this.load(), null, 2); }
  async save(value: ExperimentRecordV1) {
    const record = validateExperiment(value);
    return this.lock(() => {
      const original = this.storage.getItem(EXPERIMENTS_KEY), records = parse(original);
      const previous = records.find(row => row.id === record.id);
      if (previous) {
        if (JSON.stringify(previous) !== JSON.stringify(record)) throw new Error('Ese identificador ya está guardado con otro contenido. El registro original se conservó.');
        return records;
      }
      if (this.storage.getItem(EXPERIMENTS_KEY) !== original) throw new Error('Otra pestaña cambió el historial. Vuelve a intentar.');
      const next = [record, ...records];
      this.storage.setItem(EXPERIMENTS_KEY, JSON.stringify(next));
      return next;
    });
  }
}
