import type { ExperimentStorage } from './storage';
import { validateExperimentV2, type ExperimentRecordV2 } from './v2';
export const EXPERIMENTS_V2_KEY = 'fh:experiment-sessions-v2';
export type ExperimentV2Lock = <T>(operation: () => Promise<T>) => Promise<T>;
const browserLock: ExperimentV2Lock = async operation => {
  if (typeof navigator === 'undefined' || !navigator.locks) throw new Error('No hay bloqueo seguro entre pestañas. Exporta el experimento V2.');
  return navigator.locks.request(EXPERIMENTS_V2_KEY, operation);
};
async function parse(raw: string | null): Promise<ExperimentRecordV2[]> {
  if (raw === null) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) throw new Error();
    const records = await Promise.all(value.map(validateExperimentV2));
    if (new Set(records.map(record => record.id)).size !== records.length) throw new Error();
    return records;
  } catch { throw new Error('Historial V2 inválido. No se sobrescribió ni se reparó. Exporta el original.'); }
}
export class ExperimentStoreV2 {
  constructor(private storage: ExperimentStorage, private lock: ExperimentV2Lock = browserLock) {}
  load() { return parse(this.storage.getItem(EXPERIMENTS_V2_KEY)); }
  async exportJSON() { return JSON.stringify(await this.load(), null, 2); }
  async save(value: unknown) {
    const record = await validateExperimentV2(value);
    return this.lock(async () => {
      const original = this.storage.getItem(EXPERIMENTS_V2_KEY), records = await parse(original);
      const previous = records.find(row => row.id === record.id);
      if (previous && JSON.stringify(previous) !== JSON.stringify(record)) throw new Error('Ese ID V2 ya tiene otro contenido; no se reemplaza.');
      if (this.storage.getItem(EXPERIMENTS_V2_KEY) !== original) throw new Error('El historial V2 cambió durante la validación. Reintenta sin sobrescribirlo.');
      if (previous) return records;
      const next = [record, ...records];
      this.storage.setItem(EXPERIMENTS_V2_KEY, JSON.stringify(next));
      return next;
    });
  }
}
