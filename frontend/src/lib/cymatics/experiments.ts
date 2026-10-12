import type { CymaticsConfigV1 } from './types';
import { getCymaticsProtocol } from './protocols';
import { validateCymaticsConfig } from './storage';

export const CYMATICS_EXPERIMENT_STORAGE_KEY='fh:cymatics-experiments-v2';
export interface CymaticsExperimentV2 {
  schemaVersion:2;
  id:string;
  createdAt:string;
  protocol:{id:string;version:'cymatics-protocol-v1'};
  configurationSnapshot:CymaticsConfigV1;
  observation:{note?:string;peakFrequencyHz?:number;peakDbfs?:number;estimatedPitchHz?:number};
  provenance:{modelVersion:'cymatics-modal-v1';spectralMethod?:'radix-2-fft-hann-v1'};
}

const exactKeys=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).length===keys.length&&keys.every(key=>key in value);
const finiteOptional=(value:unknown)=>value===undefined||typeof value==='number'&&Number.isFinite(value);
export function validateCymaticsExperiment(value:unknown):CymaticsExperimentV2 {
  if(!value||typeof value!=='object')throw new Error('Experimento cimático inválido.');
  const row=value as Record<string,unknown>;
  if(!exactKeys(row,['schemaVersion','id','createdAt','protocol','configurationSnapshot','observation','provenance'])||row.schemaVersion!==2||typeof row.id!=='string'||!row.id||typeof row.createdAt!=='string'||!Number.isFinite(Date.parse(row.createdAt)))throw new Error('Experimento cimático inválido.');
  const protocol=row.protocol as Record<string,unknown>;
  if(!protocol||!exactKeys(protocol,['id','version'])||typeof protocol.id!=='string'||protocol.version!=='cymatics-protocol-v1')throw new Error('Protocolo de experimento inválido.');
  getCymaticsProtocol(protocol.id);
  const configurationSnapshot=validateCymaticsConfig(row.configurationSnapshot);
  const observation=row.observation as Record<string,unknown>;
  if(!observation||Object.keys(observation).some(key=>!['note','peakFrequencyHz','peakDbfs','estimatedPitchHz'].includes(key))||observation.note!==undefined&&(typeof observation.note!=='string'||observation.note.length>1000)||!finiteOptional(observation.peakFrequencyHz)||!finiteOptional(observation.peakDbfs)||!finiteOptional(observation.estimatedPitchHz))throw new Error('Observación cimática inválida.');
  const provenance=row.provenance as Record<string,unknown>;
  if(!provenance||Object.keys(provenance).some(key=>!['modelVersion','spectralMethod'].includes(key))||provenance.modelVersion!=='cymatics-modal-v1'||provenance.spectralMethod!==undefined&&provenance.spectralMethod!=='radix-2-fft-hann-v1')throw new Error('Procedencia cimática inválida.');
  return structuredClone({...row,configurationSnapshot}) as unknown as CymaticsExperimentV2;
}
export function createCymaticsExperiment(input:{id:string;createdAt:string;protocolId:string;config:CymaticsConfigV1;note?:string;peakFrequencyHz?:number;peakDbfs?:number;estimatedPitchHz?:number}):CymaticsExperimentV2 {
  const hasSpectrum=input.peakFrequencyHz!==undefined||input.peakDbfs!==undefined;
  return validateCymaticsExperiment({schemaVersion:2,id:input.id,createdAt:input.createdAt,protocol:{id:input.protocolId,version:'cymatics-protocol-v1'},configurationSnapshot:structuredClone(input.config),observation:{...(input.note?{note:input.note}:{}),...(input.peakFrequencyHz!==undefined?{peakFrequencyHz:input.peakFrequencyHz}:{}),...(input.peakDbfs!==undefined?{peakDbfs:input.peakDbfs}:{}),...(input.estimatedPitchHz!==undefined?{estimatedPitchHz:input.estimatedPitchHz}:{})},provenance:{modelVersion:'cymatics-modal-v1',...(hasSpectrum?{spectralMethod:'radix-2-fft-hann-v1'}:{})}});
}
export function readCymaticsExperiments(storage:Storage=localStorage):CymaticsExperimentV2[]{const raw=storage.getItem(CYMATICS_EXPERIMENT_STORAGE_KEY);if(raw===null)return[];let parsed:unknown;try{parsed=JSON.parse(raw);}catch{throw new Error('El historial de experimentos está dañado; no se modificó.');}if(!Array.isArray(parsed))throw new Error('El historial de experimentos está dañado; no se modificó.');const rows=parsed.map(validateCymaticsExperiment);if(new Set(rows.map(row=>row.id)).size!==rows.length)throw new Error('El historial contiene identificadores duplicados; no se modificó.');return rows;}
export function saveCymaticsExperiment(experiment:CymaticsExperimentV2,storage:Storage=localStorage){const valid=validateCymaticsExperiment(experiment),rows=readCymaticsExperiments(storage);if(rows.some(row=>row.id===valid.id))throw new Error('El experimento ya existe; no se sobrescribió.');storage.setItem(CYMATICS_EXPERIMENT_STORAGE_KEY,JSON.stringify([...rows,valid]));}
