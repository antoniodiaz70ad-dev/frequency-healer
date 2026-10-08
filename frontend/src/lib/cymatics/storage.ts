import type { CymaticsConfigV1 } from './types';
import { AUDIO_MAX_HZ, AUDIO_MIN_HZ, CYMATICS_MODEL_VERSION } from './physics';

export const CYMATICS_STORAGE_KEY='fh:cymatics-gallery-v1';
const finite=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function validateCymaticsConfig(v:unknown):CymaticsConfigV1 {
  if(!v||typeof v!=='object')throw new Error('Configuración cimática inválida.');const c=v as CymaticsConfigV1;
  if(c.schemaVersion!==1||c.modelVersion!==CYMATICS_MODEL_VERSION)throw new Error('Versión de modelo no compatible; no puede reproducirse exactamente.');
  if(typeof c.id!=='string'||!c.id||typeof c.createdAt!=='string'||typeof c.title!=='string'||c.title.length>100)throw new Error('Identidad inválida.');
  if(!['square-plate','circular-membrane'].includes(c.surfaceType)||!['simply-supported','fixed-edge'].includes(c.boundaryCondition))throw new Error('Superficie inválida.');
  if((c.surfaceType==='square-plate')!==(c.boundaryCondition==='simply-supported'))throw new Error('Condición de borde incompatible.');
  if(!Array.isArray(c.channelFrequenciesHz)||c.channelFrequenciesHz.length<1||c.channelFrequenciesHz.length>2||!c.channelFrequenciesHz.every(f=>finite(f,AUDIO_MIN_HZ,AUDIO_MAX_HZ)))throw new Error('Frecuencias inválidas.');
  if(!['sine','square','triangle','sawtooth'].includes(c.waveform)||!finite(c.damping,.001,.3)||!finite(c.excitationPosition?.x,0,1)||!finite(c.excitationPosition?.y,0,1)||!finite(c.modeCutoff,1,8))throw new Error('Parámetros físicos inválidos.');
  const nums=[c.dimensionsSI?.widthM,c.dimensionsSI?.heightM,c.dimensionsSI?.thicknessM,c.dimensionsSI?.radiusM,c.materialSI?.youngModulusPa,c.materialSI?.densityKgM3,c.materialSI?.tensionNm,c.materialSI?.surfaceDensityKgM2];if(!nums.every(n=>finite(n,1e-6,1e13)))throw new Error('Dimensiones o material inválidos.');
  return structuredClone(c);
}
export function readCymaticsGallery(storage:Pick<Storage,'getItem'>=localStorage):CymaticsConfigV1[]{const raw=storage.getItem(CYMATICS_STORAGE_KEY);if(!raw)return[];const parsed=JSON.parse(raw);if(!Array.isArray(parsed))throw new Error('Galería cimática dañada; no fue modificada.');return parsed.map(validateCymaticsConfig);}
export function saveCymaticsFigure(c:CymaticsConfigV1,storage:Pick<Storage,'getItem'|'setItem'>=localStorage){const rows=readCymaticsGallery(storage);if(rows.some(r=>r.id===c.id))throw new Error('Ese identificador ya existe. Crea una captura nueva.');const valid=validateCymaticsConfig(c);storage.setItem(CYMATICS_STORAGE_KEY,JSON.stringify([...rows,valid]));return valid;}
export function parseCymaticsImport(raw:string){if(raw.length>100_000)throw new Error('Archivo demasiado grande.');return validateCymaticsConfig(JSON.parse(raw));}
