import { ADAPTIVE_EXPERIMENTS_KEY, AdaptiveExperimentStore } from './adaptive/storage';
import { DISCOVERY_KEY, DiscoveryStore } from './discovery/storage';
import { EXPERIMENTS_KEY, ExperimentStore } from './experiments/storage';
import { EXPERIMENTS_V2_KEY, ExperimentStoreV2 } from './experiments/storageV2';
import { CONSTELLATIONS_KEY, ConstellationStore } from './harmonic/constellationStorage';
import { PERSONALIZED_EXPERIMENTS_KEY, PersonalizedExperimentStore } from './personalization/storage';
import { CONSENT_KEY, SETTINGS_KEY } from './voice/privacy';
import { SESSIONS_KEY, VoiceStore, loadSettings } from './voice/storage';

export const OBE_SESSION_LOGS_KEY = 'fh:obe-session-logs-v1';
export const NEXT_SESSION_CONFIG_KEY = 'fh:next-session-config-v1';
export const DISCLAIMER_ACCEPTED_KEY = 'fh:hemi-sync-disclaimer-accepted-v1';

export const FREQUENCY_HEALER_STORAGE_ALLOWLIST = Object.freeze([
  SESSIONS_KEY, CONSENT_KEY, SETTINGS_KEY, EXPERIMENTS_KEY, EXPERIMENTS_V2_KEY,
  CONSTELLATIONS_KEY, DISCOVERY_KEY, PERSONALIZED_EXPERIMENTS_KEY,
  ADAPTIVE_EXPERIMENTS_KEY, OBE_SESSION_LOGS_KEY, NEXT_SESSION_CONFIG_KEY,
  DISCLAIMER_ACCEPTED_KEY,
] as const);

export type FrequencyHealerStorageKey = typeof FREQUENCY_HEALER_STORAGE_ALLOWLIST[number];
export interface ReadOnlyStorage { getItem(key:string):string|null }
export interface ExportNamespace { key:FrequencyHealerStorageKey;raw:string|null;status:'absent'|'valid'|'invalid';recordCount?:number;error?:string }
export interface UnifiedExportV1 {
  schemaVersion:1;generationVersion:'frequency-healer-data-export-v1';exportedAt:string;
  seedSelectionProvenance:{requiredForRuleVersion:'voice-rules-v2';seedRegistryVersion:'seed-registry-v1';seedSelectionVersion:'seed-selection-v1';voiceRecordsStatus:'absent'|'valid'|'invalid';legacyProposalCount:number;v2ProposalCount:number};
  namespaces:ExportNamespace[];integrity:{algorithm:'sha256';digest:string};
}

const reader=(raw:string|null):{getItem:(key:string)=>string|null;setItem:()=>never}=>({getItem:()=>raw,setItem:()=>{throw new Error('El exportador es de solo lectura.');}});
const object=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Objeto inválido.');return value as Record<string,unknown>;};
const finite=(value:unknown,min:number,max:number)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
const iso=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value));

function validateConsent(raw:string){const v=object(JSON.parse(raw));if(v.schemaVersion!==1||typeof v.version!=='string'||!iso(v.acceptedAt))throw new Error('Consentimiento inválido.');return 1;}
function validateObe(raw:string){const rows=JSON.parse(raw);if(!Array.isArray(rows))throw new Error('Diario OBE inválido.');const ids=new Set<string>();for(const input of rows){const v=object(input);if(typeof v.id!=='string'||ids.has(v.id)||!finite(v.createdAt,0,Number.MAX_SAFE_INTEGER)||typeof v.sessionDate!=='string'||typeof v.focusLabel!=='string'||!finite(v.durationMinutes,1,1440)||typeof v.paralysisAchieved!=='boolean'||typeof v.vibrations!=='boolean'||typeof v.separation!=='boolean'||!['none','partial','full'].includes(String(v.visualClarity))||typeof v.lookedBack!=='boolean'||!finite(v.preEnergy,1,10)||!finite(v.postEnergy,1,10)||typeof v.notes!=='string'||!Array.isArray(v.tags)||!v.tags.every(x=>typeof x==='string')||(v.intention!==undefined&&typeof v.intention!=='string'))throw new Error('Registro OBE inválido.');ids.add(v.id);}return rows.length;}
function validateNext(raw:string){const v=object(JSON.parse(raw));if(!['f10','f12','f15','f21'].includes(String(v.focusId))||!finite(v.duration,1,180)||typeof v.intention!=='string'||!finite(v.startedAt,0,Number.MAX_SAFE_INTEGER))throw new Error('Preparación OBE inválida.');return 1;}

async function validateNamespace(key:FrequencyHealerStorageKey,raw:string):Promise<number>{
  const store=reader(raw);
  if(key===SESSIONS_KEY)return new VoiceStore(store).load().length;
  if(key===CONSENT_KEY)return validateConsent(raw);
  if(key===SETTINGS_KEY){loadSettings(store);return 1;}
  if(key===EXPERIMENTS_KEY)return new ExperimentStore(store).load().length;
  if(key===EXPERIMENTS_V2_KEY)return (await new ExperimentStoreV2(store).load()).length;
  if(key===CONSTELLATIONS_KEY)return (await new ConstellationStore(store).load()).length;
  if(key===DISCOVERY_KEY)return (await new DiscoveryStore(store).load()).length;
  if(key===PERSONALIZED_EXPERIMENTS_KEY)return (await new PersonalizedExperimentStore(store).load()).length;
  if(key===ADAPTIVE_EXPERIMENTS_KEY)return (await new AdaptiveExperimentStore(store).load()).length;
  if(key===OBE_SESSION_LOGS_KEY)return validateObe(raw);
  if(key===NEXT_SESSION_CONFIG_KEY)return validateNext(raw);
  if(raw!=='1')throw new Error('Aceptación de seguridad inválida.');return 1;
}

function seedCounts(raw:string|null){
  if(raw===null)return {voiceRecordsStatus:'absent' as const,legacyProposalCount:0,v2ProposalCount:0};
  try{const records=new VoiceStore(reader(raw)).load();let legacyProposalCount=0,v2ProposalCount=0;
    for(const record of records){if(record.proposal.ruleVersion==='voice-rules-v2'){if(!record.proposal.seedSelection||!record.proposal.proposalIdentity)throw new Error('Falta procedencia Seed Selection V1.');v2ProposalCount++;}else legacyProposalCount++;}
    return {voiceRecordsStatus:'valid' as const,legacyProposalCount,v2ProposalCount};
  }catch{return {voiceRecordsStatus:'invalid' as const,legacyProposalCount:0,v2ProposalCount:0};}
}

function canonicalPayload(value:Omit<UnifiedExportV1,'integrity'>){return JSON.stringify(value);}
async function sha256(value:string){const bytes=new TextEncoder().encode(value),hash=await crypto.subtle.digest('SHA-256',bytes);return `sha256:${Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('')}`;}

export async function createUnifiedExport(storage:ReadOnlyStorage,exportedAt=new Date().toISOString()):Promise<UnifiedExportV1>{
  if(!iso(exportedAt))throw new Error('Fecha de exportación inválida.');
  const namespaces:ExportNamespace[]=[];
  for(const key of FREQUENCY_HEALER_STORAGE_ALLOWLIST){const raw=storage.getItem(key);if(raw===null){namespaces.push({key,raw:null,status:'absent'});continue;}try{namespaces.push({key,raw,status:'valid',recordCount:await validateNamespace(key,raw)});}catch(e){namespaces.push({key,raw,status:'invalid',error:(e as Error).message});}}
  const counts=seedCounts(storage.getItem(SESSIONS_KEY));
  const payload={schemaVersion:1 as const,generationVersion:'frequency-healer-data-export-v1' as const,exportedAt,seedSelectionProvenance:{requiredForRuleVersion:'voice-rules-v2' as const,seedRegistryVersion:'seed-registry-v1' as const,seedSelectionVersion:'seed-selection-v1' as const,...counts},namespaces};
  return {...payload,integrity:{algorithm:'sha256',digest:await sha256(canonicalPayload(payload))}};
}

export async function verifyUnifiedExport(input:unknown):Promise<UnifiedExportV1>{
  const value=object(input) as unknown as UnifiedExportV1;
  if(value.schemaVersion!==1||value.generationVersion!=='frequency-healer-data-export-v1'||!iso(value.exportedAt)||!Array.isArray(value.namespaces)||value.integrity?.algorithm!=='sha256')throw new Error('Contrato de exportación inválido.');
  if(value.namespaces.length!==FREQUENCY_HEALER_STORAGE_ALLOWLIST.length||value.namespaces.some((row,index)=>row.key!==FREQUENCY_HEALER_STORAGE_ALLOWLIST[index]))throw new Error('La allowlist o su orden no coincide.');
  const read=new Map<string,string|null>();
  for(const row of value.namespaces){if(!['absent','valid','invalid'].includes(row.status)||!(row.raw===null||typeof row.raw==='string'))throw new Error('Entrada de namespace inválida.');if((row.raw===null)!==(row.status==='absent'))throw new Error('Estado de namespace inconsistente.');if(row.raw!==null){let count:number|undefined,validationError:unknown;try{count=await validateNamespace(row.key,row.raw);}catch(e){validationError=e;}if(validationError===undefined){if(row.status!=='valid'||row.recordCount!==count||row.error!==undefined)throw new Error('Validación declarada inconsistente.');}else if(row.status!=='invalid'||typeof row.error!=='string'||row.recordCount!==undefined)throw new Error('Error de validación no declarado.');}read.set(row.key,row.raw);}
  const counts=seedCounts(read.get(SESSIONS_KEY)??null),provenance=value.seedSelectionProvenance;
  if(!provenance||provenance.requiredForRuleVersion!=='voice-rules-v2'||provenance.seedRegistryVersion!=='seed-registry-v1'||provenance.seedSelectionVersion!=='seed-selection-v1'||provenance.legacyProposalCount!==counts.legacyProposalCount||provenance.v2ProposalCount!==counts.v2ProposalCount)throw new Error('Procedencia Seed Selection V1 inválida.');
  const {integrity,...payload}=value;if(integrity.digest!==await sha256(canonicalPayload(payload)))throw new Error('La huella SHA-256 no coincide.');return value;
}
