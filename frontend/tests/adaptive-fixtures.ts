import { interpretGuidedIntent, recommendGuided } from '../src/lib/guided/recommendations';
import { candidate, createPlan, validatePlan, type ProtocolDiscoveryPlanV1 } from '../src/lib/discovery/model';
import { compileConstellation } from '../src/lib/harmonic/constellations';
import { prepareExperimentV2, transitionExperimentV2 } from '../src/lib/experiments/v2';
export const adaptiveContext={tags:['after-work'],device:'headphones',timeOfDay:'evening'};
export async function adaptiveFixture(counts:number[],options:{deltas?:number[][];expectations?:number[][];constellation?:boolean;singleFirst?:boolean}={}) {
  const intent=interpretGuidedIntent('Quiero recuperarme 5 minutos'),base=recommendGuided(intent).proposal.harmonicConfig;
  const candidates=await Promise.all(counts.map(async(_,i)=>candidate(intent,`candidate-${i}`,`Protocolo ${String.fromCharCode(65+i)}`,{...base,baseHz:[144,220,300][i],uiVolume:0,...(options.constellation?{durationSeconds:1.2}:{})},options.constellation?await compileConstellation({id:`adaptive-source-${i}`,name:`Adaptive source ${i}`,seedFrequencyHz:[144,220,300][i],playbackMode:'sequence',members:[{id:'r',relationshipType:'root'},...(options.singleFirst&&i===0?[]:[{id:'f',relationshipType:'ratio' as const,ratio:{numerator:3,denominator:2}}])]}):undefined)));
  const plans:ProtocolDiscoveryPlanV1[]=[];
  for(let block=0;block<Math.max(1,Math.ceil(Math.max(...counts)/10));block++){
    const p=structuredClone(await createPlan({intent,primaryMetric:'energy',candidates,assignmentStrategy:'balanced',randomSeed:42,minimumSessionsPerCandidate:10},`adaptive-plan-${block}` as ReturnType<typeof crypto.randomUUID>,'2026-09-01T12:00:00.000Z'));
    for(const a of p.assignments){const i=a.index%counts.length,round=block*10+Math.floor(a.index/counts.length);if(round>=counts[i]){a.status='skipped';a.resolvedAt='2026-09-01T12:05:01.000Z';continue;}
      const c=candidates[i],delta=options.deltas?.[i]?.[round]??i+1,pre=delta>=0?0:10;
      let e=await prepareExperimentV2(c.config,{intention:intent.intent.intention,preState:{energy:pre},expectationScore:options.expectations?.[i]?.[round]??5},c.constellation,`${p.id}-${a.index}`,'2026-09-01T12:00:00.000Z');
      e=transitionExperimentV2(transitionExperimentV2(e,'started','2026-09-01T12:00:01.000Z'),'completed','2026-09-01T12:05:01.000Z');
      a.status='completed';a.attemptId=e.id;a.reservedAt=e.createdAt;a.resolvedAt=e.endedAt;a.result={schemaVersion:1,planId:p.id,candidateId:c.id,assignmentIndex:a.index,context:adaptiveContext,experiment:{...e,postState:{energy:pre+delta}}};
    }p.status='completed';plans.push(await validatePlan(p));
  }return plans;
}
