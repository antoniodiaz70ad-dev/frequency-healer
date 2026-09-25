import type { ExperimentStorage } from '../experiments/storage';
import { validateExperimentV2, type ExperimentRecordV2 } from '../experiments/v2';
import { assert, freeze, same } from '../discovery/model';
import { validatePersonalization, type PersonalizedRecommendationSetV1 } from './ranking';
export const PERSONALIZED_EXPERIMENTS_KEY = 'fh:personalized-experiments-v1';
export interface PersonalizedExperimentV1 {
  schemaVersion: 1;
  recommendation: PersonalizedRecommendationSetV1;
  selectedCandidateId: string;
  experiment: ExperimentRecordV2;
}
export async function validatePersonalizedExperiment(input: unknown): Promise<PersonalizedExperimentV1> {
  const v = structuredClone(input) as PersonalizedExperimentV1;
  assert(v && typeof v === 'object' && v.schemaVersion === 1 && Object.keys(v).every(k => ['schemaVersion','recommendation','selectedCandidateId','experiment'].includes(k)), 'Registro personalizado inválido.');
  const recommendation = await validatePersonalization(v.recommendation);
  const selected = recommendation.recommendations.find(r => r.candidateId === v.selectedCandidateId);
  assert(selected, 'El candidato no pertenece a la recomendación.');
  const experiment = await validateExperimentV2(v.experiment);
  assert(experiment.status !== 'started', 'Detén la sesión antes de guardar.');
  assert(same(experiment.configurationSnapshot, selected.candidate.config) && same(experiment.constellation?.snapshot, selected.candidate.constellation), 'La ejecución no coincide con el candidato elegido.');
  assert(experiment.intention === recommendation.intent.intent.intention && experiment.expectationScore !== undefined && experiment.context === JSON.stringify(recommendation.context), 'Intención, expectativa o contexto inválidos.');
  return freeze({ schemaVersion: 1, recommendation, selectedCandidateId: selected.candidateId, experiment });
}
type Lock = <T>(operation: () => Promise<T>) => Promise<T>;
const browserLock: Lock = async operation => {
  assert(typeof navigator !== 'undefined' && navigator.locks, 'Sin bloqueo seguro; exporta el borrador.');
  return navigator.locks.request(PERSONALIZED_EXPERIMENTS_KEY, operation);
};
async function parse(raw: string | null) {
  if (raw === null) return [];
  try {
    const values = JSON.parse(raw); assert(Array.isArray(values), 'No es una lista.');
    const rows = await Promise.all(values.map(validatePersonalizedExperiment));
    assert(new Set(rows.map(r => r.experiment.id)).size === rows.length, 'IDs repetidos.'); return rows;
  } catch { throw new Error('Historial personalizado inválido. No se repara ni sobrescribe. Exporta el original.'); }
}
export class PersonalizedExperimentStore {
  constructor(private storage: ExperimentStorage, private lock: Lock = browserLock) {}
  load() { return parse(this.storage.getItem(PERSONALIZED_EXPERIMENTS_KEY)); }
  async save(value: unknown) {
    const record = await validatePersonalizedExperiment(value);
    return this.lock(async () => {
      const original = this.storage.getItem(PERSONALIZED_EXPERIMENTS_KEY), rows = await parse(original);
      const existing = rows.find(r => r.experiment.id === record.experiment.id);
      assert(!existing || same(existing, record), 'Ese ID ya existe con otro contenido.');
      assert(this.storage.getItem(PERSONALIZED_EXPERIMENTS_KEY) === original, 'El historial cambió durante la validación.');
      if (existing) return rows;
      const next = [record, ...rows]; this.storage.setItem(PERSONALIZED_EXPERIMENTS_KEY, JSON.stringify(next)); return next;
    });
  }
}
