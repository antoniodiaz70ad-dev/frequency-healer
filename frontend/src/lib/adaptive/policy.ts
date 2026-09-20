import { assert, freeze, same, type ProtocolCandidateV1 } from '../discovery/model';
import { contextKey, statistics } from '../discovery/analysis';
import { validatePersonalization, evidenceLevel, METRIC_DIRECTION, type PersonalizedRecommendationSetV1 } from '../personalization/ranking';
import { validateExperimentV2, type ExperimentRecordV2 } from '../experiments/v2';
import { describeHarmonics, type HarmonicStructureV1 } from '../harmonic/profile/profile';

export const ADAPTIVE_VERSION='adaptive-exploration-v1' as const;
export const ADAPTIVE_POLICY={minimumN:5,imbalance:5,spread:4,meanMedianGap:1,expectationGap:2} as const;
export type AdaptiveReason='no-personal-evidence'|'insufficient-sample'|'candidate-imbalance'|'uncertainty-reduction'|'confirm-current-signal';
export interface AdaptiveEvidenceV1 { candidateId:string; experiment:ExperimentRecordV2 }
export interface CandidateExplorationStateV1 {
  candidateId:string;candidate:ProtocolCandidateV1;defaultIndex:number;
  comparableN:number;discoveryN:number;adaptiveN:number;evidenceLevel:ReturnType<typeof evidenceLevel>;
  change:ReturnType<typeof statistics>;favorableChange:ReturnType<typeof statistics>;expectation:ReturnType<typeof statistics>;
  spread:number|null;meanMedianGap:number|null;
  completionCount:number;cancelledCount:number;interruptedCount:number;incompletePairCount:number;
  structure:HarmonicStructureV1;
  provenance:{source:'discovery'|'adaptive';planId?:string;experimentId:string;status:ExperimentRecordV2['status'];pre?:number;post?:number;expectation:number}[];
}
export interface AdaptiveExplorationSuggestionV1 {
  schemaVersion:1;algorithmVersion:typeof ADAPTIVE_VERSION;
  intentCategory:string;targetMetric:PersonalizedRecommendationSetV1['targetMetric'];
  basis:PersonalizedRecommendationSetV1;followups:AdaptiveEvidenceV1[];
  candidates:CandidateExplorationStateV1[];currentBestCandidateId?:string;suggestedNextCandidateId:string;reason:AdaptiveReason;
  explanation:{policy:typeof ADAPTIVE_POLICY;minN:number;maxN:number;expectationDifference:number|null;expectationConfound:boolean;criterion:string};
  coverage:{dimension:'candidates'|'seeds'|'ratios'|'octaves'|'modes'|'hciBands';value:string;candidateIds:string[];comparableN:number}[];
}
export async function validateAdaptiveEvidence(basis:PersonalizedRecommendationSetV1,input:AdaptiveEvidenceV1):Promise<AdaptiveEvidenceV1> {
  const v=structuredClone(input);
  assert(v&&Object.keys(v).every(k=>['candidateId','experiment'].includes(k)),'Evidencia adaptativa inválida.');
  const c=basis.recommendations.find(r=>r.candidateId===v.candidateId)?.candidate;assert(c,'Candidato desconocido.');
  const e=await validateExperimentV2(v.experiment);
  assert(e.status!=='started','No se guarda ni analiza una ejecución activa.');
  assert(same(e.configurationSnapshot,c.config)&&same(e.constellation?.snapshot,c.constellation),'La ejecución no coincide con el candidato exacto.');
  assert(e.intention===basis.intent.intent.intention&&e.expectationScore!==undefined&&e.context===JSON.stringify(basis.context),'Intención, expectativa o contexto distintos.');
  return freeze({candidateId:c.id,experiment:e});
}
/** Same complete experimental contract; never match merely by seed or candidate label. */
export function compatibleAdaptiveBasis(a:PersonalizedRecommendationSetV1,b:PersonalizedRecommendationSetV1) {
  const key=(r:PersonalizedRecommendationSetV1)=>[r.intent,r.targetMetric,r.context,r.sourcePlans[0].comparabilityPolicy,[...r.recommendations].sort((a,b)=>a.defaultIndex-b.defaultIndex).map(c=>c.candidate)];
  return same(key(a),key(b));
}
export async function suggestNext(input:PersonalizedRecommendationSetV1,additional:readonly AdaptiveEvidenceV1[]=[]):Promise<AdaptiveExplorationSuggestionV1> {
  const captured=structuredClone(additional),basis=await validatePersonalization(input);
  const followups=(await Promise.all(captured.map(e=>validateAdaptiveEvidence(basis,e)))).sort((a,b)=>a.experiment.id<b.experiment.id?-1:a.experiment.id>b.experiment.id?1:0);
  const seen=new Set(basis.sourcePlans.flatMap(p=>p.assignments.flatMap(a=>a.result?[a.result.experiment.id]:[])));
  for(const f of followups){assert(!seen.has(f.experiment.id),'Experimento repetido; no se infla N.');seen.add(f.experiment.id);}
  const direction=METRIC_DIRECTION[basis.targetMetric];
  const candidates=await Promise.all([...basis.recommendations].sort((a,b)=>a.defaultIndex-b.defaultIndex).map(async (r):Promise<CandidateExplorationStateV1>=>{
    const provenance:CandidateExplorationStateV1['provenance']=[];
    const add=(e:ExperimentRecordV2,source:'discovery'|'adaptive',planId?:string)=>{
      const pre=e.preState[basis.targetMetric],post=e.postState[basis.targetMetric];
      provenance.push({source,...(planId?{planId}:{}),experimentId:e.id,status:e.status,...(pre===undefined?{}:{pre}),...(post===undefined?{}:{post}),expectation:e.expectationScore!});
    };
    for(const p of basis.sourcePlans)for(const a of p.assignments)if(a.candidateId===r.candidateId&&a.result&&contextKey(a.result.context)===contextKey(basis.context))add(a.result.experiment,'discovery',p.id);
    followups.filter(e=>e.candidateId===r.candidateId).forEach(e=>add(e.experiment,'adaptive'));
    const completed=provenance.filter(p=>p.status==='completed'),paired=completed.filter(p=>p.pre!==undefined&&p.post!==undefined);
    const change=statistics(paired.map(p=>p.post!-p.pre!)),favorableChange=statistics(paired.map(p=>direction*(p.post!-p.pre!)));
    return {candidateId:r.candidateId,candidate:r.candidate,defaultIndex:r.defaultIndex,comparableN:paired.length,discoveryN:paired.filter(p=>p.source==='discovery').length,adaptiveN:paired.filter(p=>p.source==='adaptive').length,evidenceLevel:evidenceLevel(paired.length),change,favorableChange,expectation:statistics(paired.map(p=>p.expectation)),spread:change.n?change.max!-change.min!:null,meanMedianGap:change.n?Math.abs(change.mean!-change.median!):null,completionCount:completed.length,cancelledCount:provenance.filter(p=>p.status==='cancelled').length,interruptedCount:provenance.filter(p=>p.status==='interrupted').length,incompletePairCount:completed.length-paired.length,
      structure:await describeHarmonics(r.candidate.constellation?{sourceType:'harmonic-constellation',constellation:r.candidate.constellation}:{sourceType:'legacy-harmonic-config',configuration:r.candidate.config}),provenance};
  }));
  const currentBestCandidateId=basis.orderingApplied?basis.orderedCandidateIds[0]:undefined;
  const minN=Math.min(...candidates.map(c=>c.comparableN)),maxN=Math.max(...candidates.map(c=>c.comparableN));
  const means=candidates.flatMap(c=>c.expectation.mean===null?[]:[c.expectation.mean]);
  const expectationDifference=means.length>1?Math.max(...means)-Math.min(...means):null,expectationConfound=expectationDifference!==null&&expectationDifference>=ADAPTIVE_POLICY.expectationGap;
  const least=[...candidates].sort((a,b)=>a.comparableN-b.comparableN||a.defaultIndex-b.defaultIndex)[0];
  const uncertain=(c:CandidateExplorationStateV1)=>c.favorableChange.median!==null&&c.favorableChange.median>0&&((c.spread??0)>=ADAPTIVE_POLICY.spread||(c.meanMedianGap??0)>=ADAPTIVE_POLICY.meanMedianGap);
  const best=candidates.find(c=>c.candidateId===currentBestCandidateId);
  let selected=least,reason:AdaptiveReason,criterion:string;
  if(maxN===0){reason='no-personal-evidence';criterion='original-order';}
  else if(minN<ADAPTIVE_POLICY.minimumN){reason='insufficient-sample';criterion='lowest-N-below-floor';}
  else if(maxN-minN>=ADAPTIVE_POLICY.imbalance){reason='candidate-imbalance';criterion='lowest-N-five-session-gap';}
  else if(expectationConfound){reason='uncertainty-reduction';criterion='expectation-confound-lowest-N';}
  else if(best&&uncertain(best)){selected=best;reason='confirm-current-signal';criterion='current-best-variable-positive-signal';}
  else {
    const variable=candidates.filter(uncertain).sort((a,b)=>(b.spread??0)-(a.spread??0)||(b.meanMedianGap??0)-(a.meanMedianGap??0)||a.comparableN-b.comparableN||a.defaultIndex-b.defaultIndex)[0];
    if(variable){selected=variable;reason='uncertainty-reduction';criterion='positive-signal-spread-mean-median';}
    else if(best){selected=best;reason='confirm-current-signal';criterion='balanced-confirm-phase-2d';}
    else {reason='uncertainty-reduction';criterion='no-established-best-lowest-N';}
  }
  const coverage:AdaptiveExplorationSuggestionV1['coverage']=[];
  for(const c of candidates){const h=c.structure.hip;const values={candidates:c.candidateId,seeds:String(h.seedFrequencyHz),ratios:JSON.stringify([...new Set(h.members.map(m=>m.relationshipKey))].sort()),octaves:JSON.stringify({explicitOffsets:h.octaveOffsets,spectralOctaveSpan:h.octaveSpan}),modes:h.playbackMode,hciBands:c.structure.hci.band};
    for(const dimension of Object.keys(values) as (keyof typeof values)[]){const value=values[dimension],row=coverage.find(g=>g.dimension===dimension&&g.value===value);if(row){row.candidateIds.push(c.candidateId);row.comparableN+=c.comparableN;}else coverage.push({dimension,value,candidateIds:[c.candidateId],comparableN:c.comparableN});}
  }
  return freeze({schemaVersion:1,algorithmVersion:ADAPTIVE_VERSION,intentCategory:basis.intent.intent.goal,targetMetric:basis.targetMetric,basis,followups,candidates,...(currentBestCandidateId?{currentBestCandidateId}:{}),suggestedNextCandidateId:selected.candidateId,reason,explanation:{policy:ADAPTIVE_POLICY,minN,maxN,expectationDifference,expectationConfound,criterion},coverage});
}
export async function validateSuggestion(input:AdaptiveExplorationSuggestionV1) {
  const v=structuredClone(input);assert(v?.schemaVersion===1&&v.algorithmVersion===ADAPTIVE_VERSION,'Versión adaptativa inválida.');
  const rebuilt=await suggestNext(v.basis,v.followups);assert(same(v,rebuilt),'La sugerencia no coincide con su evidencia o política.');return rebuilt;
}
