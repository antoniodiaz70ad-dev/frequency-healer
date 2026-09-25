import type { ExperimentStorage } from '../experiments/storage';
import type { ExperimentRecordV2 } from '../experiments/v2';
import type { PersonalizedRecommendationSetV1 } from '../personalization/ranking';
import { assert, freeze, same } from '../discovery/model';
import { compatibleAdaptiveBasis, validateAdaptiveEvidence, validateSuggestion, type AdaptiveExplorationSuggestionV1 } from './policy';
export const ADAPTIVE_EXPERIMENTS_KEY='fh:adaptive-experiments-v1';
export interface AdaptiveExperimentV1 { schemaVersion:1;suggestion:AdaptiveExplorationSuggestionV1;chosenCandidateId:string;suggestionFollowed:boolean;experiment:ExperimentRecordV2 }
export async function validateAdaptiveExperiment(input:unknown):Promise<AdaptiveExperimentV1> {
  const v=structuredClone(input) as AdaptiveExperimentV1;
  assert(v&&v.schemaVersion===1&&Object.keys(v).every(k=>['schemaVersion','suggestion','chosenCandidateId','suggestionFollowed','experiment'].includes(k)),'Auditoría adaptativa inválida.');
  const suggestion=await validateSuggestion(v.suggestion),e=await validateAdaptiveEvidence(suggestion.basis,{candidateId:v.chosenCandidateId,experiment:v.experiment});
  assert(v.suggestionFollowed===(v.chosenCandidateId===suggestion.suggestedNextCandidateId),'Elección/aceptación incoherente.');
  assert(!suggestion.basis.sourcePlans.some(p=>p.assignments.some(a=>a.result?.experiment.id===e.experiment.id))&&!suggestion.followups.some(f=>f.experiment.id===e.experiment.id),'El resultado no puede ser su propia evidencia.');
  return freeze({schemaVersion:1,suggestion,chosenCandidateId:e.candidateId,suggestionFollowed:v.suggestionFollowed,experiment:e.experiment});
}
/** Called only after the store has validated every audit. Choice compliance is deliberately ignored. */
export function adaptiveFollowups(rows:readonly AdaptiveExperimentV1[],basis:PersonalizedRecommendationSetV1){
  return rows.filter(r=>compatibleAdaptiveBasis(r.suggestion.basis,basis)).map(r=>({candidateId:r.chosenCandidateId,experiment:r.experiment}));
}
type Lock=<T>(operation:()=>Promise<T>)=>Promise<T>;
const browserLock:Lock=async operation=>{assert(typeof navigator!=='undefined'&&navigator.locks,'Sin bloqueo seguro; exporta el borrador.');return navigator.locks.request(ADAPTIVE_EXPERIMENTS_KEY,operation);};
async function parse(raw:string|null){if(raw===null)return [];try{const input=JSON.parse(raw);assert(Array.isArray(input),'No es una lista.');const rows=await Promise.all(input.map(validateAdaptiveExperiment));assert(new Set(rows.map(r=>r.experiment.id)).size===rows.length,'IDs repetidos.');return rows;}catch{throw new Error('Historial adaptativo inválido. No se repara ni sobrescribe. Exporta el original.');}}
export class AdaptiveExperimentStore {
  constructor(private storage:ExperimentStorage,private lock:Lock=browserLock){}
  load(){return parse(this.storage.getItem(ADAPTIVE_EXPERIMENTS_KEY));}
  async save(value:unknown){const record=await validateAdaptiveExperiment(value);return this.lock(async()=>{
    const original=this.storage.getItem(ADAPTIVE_EXPERIMENTS_KEY),rows=await parse(original),existing=rows.find(r=>r.experiment.id===record.experiment.id);
    assert(!existing||same(existing,record),'Ese ID ya existe con otro contenido.');assert(this.storage.getItem(ADAPTIVE_EXPERIMENTS_KEY)===original,'El historial cambió durante la validación.');
    if(existing)return rows;const next=[record,...rows];this.storage.setItem(ADAPTIVE_EXPERIMENTS_KEY,JSON.stringify(next));return next;
  });}
}
