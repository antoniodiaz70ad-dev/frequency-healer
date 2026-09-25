import { validatePersonalization, evidenceLevel, EXPECTATION_GAP, type PersonalizedRecommendationSetV1, type PersonalObservationV1 } from '../../personalization/ranking';
import { statistics } from '../../discovery/analysis';
import { freeze } from '../../discovery/model';
import { describeHarmonics, HIP_VERSION, HCI_VERSION, type HarmonicStructureV1 } from './profile';
export const STRUCTURAL_GROUPS = ['hciBand','memberCount','uniqueFrequencyCount','ratioDiversity','octaveSpan','spectralSpanHz','playbackMode'] as const;
export type StructuralGroupBy=typeof STRUCTURAL_GROUPS[number];
export interface StructuralGroupV1 {
  value:string|number;
  stratum:{seedFrequencyHz:number;durationSeconds:number;uiVolume:number;playbackMode:string;waveform:string};
  candidateIds:string[];
  comparableN:number;
  evidenceLevel:ReturnType<typeof evidenceLevel>;
  change:ReturnType<typeof statistics>;
  baseline:ReturnType<typeof statistics>;
  expectation:ReturnType<typeof statistics>;
  expectationDifference:number|null;
  expectationConfound:boolean;
  associationAvailable:boolean;
  observations:(PersonalObservationV1&{candidateId:string})[];
}
export interface StructuralAnalysisV1 {
  schemaVersion:1;profileVersion:typeof HIP_VERSION;algorithmVersion:typeof HCI_VERSION;
  groupBy:StructuralGroupBy;
  evidence:PersonalizedRecommendationSetV1;
  profiles:{candidateId:string;structure:HarmonicStructureV1}[];
  groups:StructuralGroupV1[];
}
/** Extra dimension over the existing eligible population; never changes candidate order or stored data. */
export async function analyzeStructure(input:PersonalizedRecommendationSetV1, groupBy:StructuralGroupBy):Promise<StructuralAnalysisV1> {
  if(!STRUCTURAL_GROUPS.includes(groupBy))throw new Error('Agrupación estructural desconocida.');
  const evidence=await validatePersonalization(input);
  const candidates=[...evidence.recommendations].sort((a,b)=>a.defaultIndex-b.defaultIndex);
  const profiles=await Promise.all(candidates.map(async r=>({candidateId:r.candidateId,structure:await describeHarmonics(r.candidate.constellation?{sourceType:'harmonic-constellation',constellation:r.candidate.constellation}:{sourceType:'legacy-harmonic-config',configuration:r.candidate.config})})));
  const strata=new Map<string,typeof candidates>();
  const stratumOf=(r:typeof candidates[number])=>({seedFrequencyHz:r.candidate.config.baseHz,durationSeconds:r.candidate.config.durationSeconds,uiVolume:r.candidate.config.uiVolume,playbackMode:r.candidate.config.mode,waveform:r.candidate.config.waveform});
  for(const r of candidates){const key=JSON.stringify(stratumOf(r));strata.set(key,[...(strata.get(key)??[]),r]);}
  const groups:StructuralGroupV1[]=[];
  for(const rows of strata.values()) {
    const expectations=rows.flatMap(r=>r.descriptiveMetrics.expectation.mean===null?[]:[r.descriptiveMetrics.expectation.mean]);
    const expectationDifference=expectations.length>1?Math.max(...expectations)-Math.min(...expectations):null;
    const expectationConfound=expectationDifference!==null&&expectationDifference>=EXPECTATION_GAP;
    const partitions=new Map<string,typeof candidates>();
    for(const r of rows) {
      const profile=profiles.find(p=>p.candidateId===r.candidateId)!.structure;
      const value=groupBy==='hciBand'?profile.hci.band:profile.hip[groupBy];
      const key=JSON.stringify(value);partitions.set(key,[...(partitions.get(key)??[]),r]);
    }
    for(const [key,partition] of partitions) {
      const observations=partition.flatMap(r=>r.provenance.map(p=>({...p,candidateId:r.candidateId}))),n=observations.length;
      groups.push({value:JSON.parse(key),stratum:stratumOf(partition[0]),candidateIds:partition.map(r=>r.candidateId),comparableN:n,evidenceLevel:evidenceLevel(n),
        change:statistics(observations.map(o=>o.change)),baseline:statistics(observations.map(o=>o.pre)),expectation:statistics(observations.map(o=>o.expectation)),
        expectationDifference,expectationConfound,associationAvailable:n>=10&&!expectationConfound,observations});
    }
  }
  return freeze({schemaVersion:1,profileVersion:HIP_VERSION,algorithmVersion:HCI_VERSION,groupBy,evidence,profiles,groups});
}
