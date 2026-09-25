import { validateConstellation, type HarmonicConstellationV1 } from './constellations';

export const CONSTELLATIONS_KEY = 'fh:harmonic-constellations-v1';
export interface ConstellationStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export type ConstellationLock = <T>(operation: () => Promise<T>) => Promise<T>;
const browserLock: ConstellationLock = async operation => {
  if (typeof navigator === 'undefined' || !navigator.locks) return Promise.reject(new Error('No hay bloqueo seguro entre pestañas. Puedes exportar sin guardar.'));
  return navigator.locks.request(CONSTELLATIONS_KEY, operation);
};
async function parse(raw: string | null): Promise<HarmonicConstellationV1[]> {
  if (raw === null) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) throw new Error();
    const rows = await Promise.all(value.map(validateConstellation));
    if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error();
    return rows;
  } catch { throw new Error('Almacenamiento de constelaciones inválido o no verificable. No se sobrescribió. Exporta el original.'); }
}
/** Create only. Existing records, IDs and other namespaces are never replaced. */
export class ConstellationStore {
  constructor(private storage: ConstellationStorage, private lock: ConstellationLock = browserLock) {}
  load() { return parse(this.storage.getItem(CONSTELLATIONS_KEY)); }
  async create(value: unknown) {
    const record = await validateConstellation(value);
    return this.lock(async () => {
      const raw = this.storage.getItem(CONSTELLATIONS_KEY);
      const rows = await parse(raw);
      if (rows.some(row => row.id === record.id)) throw new Error('El ID ya está guardado. No se permiten reemplazos.');
      if (this.storage.getItem(CONSTELLATIONS_KEY) !== raw) throw new Error('Otra pestaña cambió el almacenamiento. Vuelve a intentar.');
      const next = [...rows, record];
      this.storage.setItem(CONSTELLATIONS_KEY, JSON.stringify(next));
      return next;
    });
  }
}
