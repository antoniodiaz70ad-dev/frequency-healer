import { buildSchedule, type HarmonicConfig } from '../harmonic/math';
import type { ParsedIntentionV1, VoiceSessionRecordV1 } from './types';
import type { ProtocolDiscoveryPlanV1 } from '../discovery/model';

export const SEED_REGISTRY_VERSION = 'seed-registry-v1' as const;
export const SEED_SELECTION_VERSION = 'seed-selection-v1' as const;
export const STRUCTURAL_TIER_TOLERANCE_OCTAVES = 0.10;
export const SEED_REGISTRY_V1 = Object.freeze([80,112,144,192,224,256,320,448,640] as const);

export interface SeedEvidenceV1 { source:'personal-n1'|'discovery'; comparableN:number; evidenceLevel:'none'|'insufficient'|'preliminary'|'descriptive'; signal?:number }
export interface SeedCandidateV1 {
  schemaVersion:1;seedHz:number;registryVersion:typeof SEED_REGISTRY_VERSION;
  eligibility:{protocolCompatible:boolean;fullScheduleValid:boolean;rangeValid:boolean};
  structural:{minDerivedHz:number;maxDerivedHz:number;spectralSpanHz:number;lowerHeadroomOctaves:number;upperHeadroomOctaves:number;boundaryHeadroomOctaves:number;centerOffsetOctaves:number;memberCount:number;uniqueFrequencyCount:number;lowerOctaveAvailable:boolean;upperOctaveAvailable:boolean};
  selectionBasis:readonly ('full-schedule-validity'|'boundary-headroom'|'spectral-placement'|'personal-n1'|'discovery')[];
  personalEvidence?:SeedEvidenceV1;discoveryEvidence?:SeedEvidenceV1;valid:boolean;rejectionReasons:readonly string[];
}
export interface SeedSelectionV1 {
  schemaVersion:1;seedRegistryVersion:typeof SEED_REGISTRY_VERSION;seedSelectionVersion:typeof SEED_SELECTION_VERSION;
  source:'automatic'|'user-customized';structuralTierToleranceOctaves:0.10;selectedSeedHz:number;
  effectiveProgression:readonly string[];candidates:readonly SeedCandidateV1[];evidenceFingerprint:string;
}
export interface SeedEvidenceInputV1 { personal?:Readonly<Record<number,SeedEvidenceV1>>;discovery?:Readonly<Record<number,SeedEvidenceV1>>;fingerprint?:string }

const level=(n:number):SeedEvidenceV1['evidenceLevel']=>n===0?'none':n<5?'insufficient':n<10?'preliminary':'descriptive';
const finite=(v:number)=>Number.isFinite(v)?v:0;
export function evidenceFingerprint(personalRaw:string|null,discoveryRaw:string|null){
  const canonical=JSON.stringify([personalRaw,discoveryRaw]);let hash=2166136261;for(const c of canonical)hash=Math.imul(hash^c.charCodeAt(0),16777619);return `seed-evidence-v1-${(hash>>>0).toString(16)}`;
}
const configKey=(c:HarmonicConfig)=>JSON.stringify([c.baseHz,c.ratioId,c.increments,c.direction,c.mode,c.durationSeconds,c.uiVolume,c.waveform,c.progression??null]);
export function personalSeedEvidence(intent:ParsedIntentionV1,config:HarmonicConfig,records:readonly VoiceSessionRecordV1[]):Record<number,SeedEvidenceV1>{
  const metric=intent.goal==='focus'?'focus':intent.goal==='relaxation'||intent.goal==='sleep_preparation'?'stress':'clarity';
  const out:Record<number,SeedEvidenceV1>={};
  for(const seed of SEED_REGISTRY_V1){const expected={...config,baseHz:seed};const rows=records.filter(r=>r.status==='completed'&&r.intent.goal===intent.goal&&r.intent.intensity===intent.intensity&&JSON.stringify(r.intent.desiredStates)===JSON.stringify(intent.desiredStates)&&configKey(r.proposal.harmonicConfig)===configKey(expected)&&!r.markers.some(m=>m.kind==='command')&&r.technical.actualDurationMs>=expected.durationSeconds*1000&&r.before?.[metric]!==undefined&&r.after?.[metric]!==undefined);
    const changes=rows.map(r=>metric==='stress'?r.before![metric]!-r.after![metric]!:r.after![metric]!-r.before![metric]!);const n=changes.length;out[seed]={source:'personal-n1',comparableN:n,evidenceLevel:level(n),...(n?{signal:changes.reduce((a,b)=>a+b,0)/n}:{})};}
  return out;
}
export function discoverySeedEvidence(intent:ParsedIntentionV1,config:HarmonicConfig,plans:readonly ProtocolDiscoveryPlanV1[]):Record<number,SeedEvidenceV1>{
  const out:Record<number,SeedEvidenceV1>={};
  for(const seed of SEED_REGISTRY_V1){const expected={...config,baseHz:seed},changes:number[]=[];for(const plan of plans){if(plan.status!=='completed'||plan.intent.intent.goal!==intent.goal||plan.intent.intent.intensity!==intent.intensity||JSON.stringify(plan.intent.intent.desiredStates)!==JSON.stringify(intent.desiredStates))continue;for(const assignment of plan.assignments){const result=assignment.result?.experiment,candidate=plan.candidates.find(c=>c.id===assignment.candidateId);if(assignment.status!=='completed'||!result||!candidate||configKey(candidate.config)!==configKey(expected))continue;const metric=plan.primaryMetric,pre=result.preState[metric],post=result.postState?.[metric];if(pre===undefined||post===undefined)continue;changes.push(metric==='tension'?pre-post:post-pre);}}
    const n=changes.length;out[seed]={source:'discovery',comparableN:n,evidenceLevel:level(n),...(n?{signal:changes.reduce((a,b)=>a+b,0)/n}:{})};}
  return out;
}
function candidate(seedHz:number,config:HarmonicConfig,evidence:SeedEvidenceInputV1):SeedCandidateV1{
  const reasons:string[]=[];let frequencies:number[]=[];try{frequencies=buildSchedule({...config,baseHz:seedHz}).steps.flatMap(s=>s.frequencies);}catch(e){reasons.push((e as Error).message);}
  const valid=frequencies.length>0, min=valid?Math.min(...frequencies):seedHz,max=valid?Math.max(...frequencies):seedHz;
  const lower=Math.log2(min/40),upper=Math.log2(2000/max),center=Math.abs(Math.log2(Math.sqrt(min*max)/Math.sqrt(40*2000)));
  const personal=evidence.personal?.[seedHz],discovery=evidence.discovery?.[seedHz];
  const selectionBasis:SeedCandidateV1['selectionBasis']=['full-schedule-validity','boundary-headroom','spectral-placement',...(personal?.evidenceLevel==='descriptive'?['personal-n1' as const]:[]),...(discovery?.evidenceLevel==='descriptive'?['discovery' as const]:[])];
  return Object.freeze({schemaVersion:1,seedHz,registryVersion:SEED_REGISTRY_VERSION,eligibility:{protocolCompatible:valid,fullScheduleValid:valid,rangeValid:valid},structural:{minDerivedHz:min,maxDerivedHz:max,spectralSpanHz:max-min,lowerHeadroomOctaves:lower,upperHeadroomOctaves:upper,boundaryHeadroomOctaves:Math.min(lower,upper),centerOffsetOctaves:center,memberCount:frequencies.length,uniqueFrequencyCount:new Set(frequencies).size,lowerOctaveAvailable:seedHz/2>=40,upperOctaveAvailable:seedHz*2<=2000},selectionBasis,...(personal?{personalEvidence:personal}:{}),...(discovery?{discoveryEvidence:discovery}:{}),valid,rejectionReasons:reasons});
}
export function selectSeed(config:HarmonicConfig,effectiveProgression:readonly string[],evidence:SeedEvidenceInputV1={},customSeed?:number):SeedSelectionV1{
  const candidates=SEED_REGISTRY_V1.map(seed=>candidate(seed,config,evidence));
  if(customSeed!==undefined){buildSchedule({...config,baseHz:customSeed});return Object.freeze({schemaVersion:1,seedRegistryVersion:SEED_REGISTRY_VERSION,seedSelectionVersion:SEED_SELECTION_VERSION,source:'user-customized',structuralTierToleranceOctaves:STRUCTURAL_TIER_TOLERANCE_OCTAVES,selectedSeedHz:customSeed,effectiveProgression:[...effectiveProgression],candidates,evidenceFingerprint:evidence.fingerprint??'seed-evidence-v1-none'});}
  const valid=candidates.filter(c=>c.valid).sort((a,b)=>b.structural.boundaryHeadroomOctaves-a.structural.boundaryHeadroomOctaves||a.structural.centerOffsetOctaves-b.structural.centerOffsetOctaves||SEED_REGISTRY_V1.indexOf(a.seedHz as never)-SEED_REGISTRY_V1.indexOf(b.seedHz as never));
  if(!valid.length)throw new Error('No hay semillas válidas para la estructura completa.');const best=valid[0];
  const tier=valid.filter(c=>best.structural.boundaryHeadroomOctaves-c.structural.boundaryHeadroomOctaves<=STRUCTURAL_TIER_TOLERANCE_OCTAVES&&Math.abs(c.structural.centerOffsetOctaves-best.structural.centerOffsetOctaves)<=STRUCTURAL_TIER_TOLERANCE_OCTAVES);
  tier.sort((a,b)=>((a.personalEvidence?.evidenceLevel==='descriptive'&&b.personalEvidence?.evidenceLevel==='descriptive')?finite(b.personalEvidence.signal??0)-finite(a.personalEvidence.signal??0):0)||((a.discoveryEvidence?.evidenceLevel==='descriptive'&&b.discoveryEvidence?.evidenceLevel==='descriptive')?finite(b.discoveryEvidence.signal??0)-finite(a.discoveryEvidence.signal??0):0)||valid.indexOf(a)-valid.indexOf(b));
  return Object.freeze({schemaVersion:1,seedRegistryVersion:SEED_REGISTRY_VERSION,seedSelectionVersion:SEED_SELECTION_VERSION,source:'automatic',structuralTierToleranceOctaves:STRUCTURAL_TIER_TOLERANCE_OCTAVES,selectedSeedHz:tier[0].seedHz,effectiveProgression:[...effectiveProgression],candidates,evidenceFingerprint:evidence.fingerprint??'seed-evidence-v1-none'});
}
