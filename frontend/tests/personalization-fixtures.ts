import { interpretGuidedIntent, recommendGuided } from '../src/lib/guided/recommendations';
import { candidate, createPlan, validatePlan, type TargetMetric } from '../src/lib/discovery/model';
import { compileConstellation } from '../src/lib/harmonic/constellations';
import { prepareExperimentV2, transitionExperimentV2 } from '../src/lib/experiments/v2';
export const fixtureContext = { tags: ['after-work'], device: 'headphones', timeOfDay: 'evening' };
export async function personalFixture(n=10, options: { planId?: string; metric?: TargetMetric; words?: string; deltas?: number[][]; expectations?: number[][]; constellation?: boolean } = {}) {
  const intent=interpretGuidedIntent(options.words??'Quiero recuperarme 5 minutos'), base=recommendGuided(intent).proposal.harmonicConfig;
  const candidates=await Promise.all([144,220].map(async(seed,i)=>candidate(intent,`candidate-${i}`,`Protocolo ${i===0?'A':'B'}`,{...base,baseHz:seed,uiVolume:0,...(options.constellation?{durationSeconds:1.2}:{})},options.constellation?await compileConstellation({id:`personal-source-${i}`,name:`Source ${i}`,seedFrequencyHz:seed,playbackMode:'sequence',members:[{id:'r',relationshipType:'root'},{id:'f',relationshipType:'ratio',ratio:{numerator:3,denominator:2}}]}):undefined)));
  const at='2026-09-01T12:00:00.000Z',start='2026-09-01T12:00:01.000Z',end='2026-09-01T12:05:01.000Z';
  const p=structuredClone(await createPlan({intent,primaryMetric:options.metric??'energy',candidates,assignmentStrategy:'balanced',randomSeed:42,minimumSessionsPerCandidate:Math.max(3,n)},(options.planId??'personal-plan') as ReturnType<typeof crypto.randomUUID>,at));
  for(const a of p.assignments){const i=a.index%2,round=Math.floor(a.index/2);if(round>=n){a.status='skipped';a.resolvedAt=end;continue;}
    const c=candidates[i],delta=options.deltas?.[i]?.[round]??i+1,pre=delta>=0?0:10;
    let e=await prepareExperimentV2(c.config,{intention:intent.intent.intention,preState:{[p.primaryMetric]:pre},expectationScore:options.expectations?.[i]?.[round]??5},c.constellation,`${p.id}-${a.index}`,at);
    e=transitionExperimentV2(transitionExperimentV2(e,'started',start),'completed',end);
    a.status='completed';a.attemptId=e.id;a.reservedAt=at;a.resolvedAt=end;a.result={schemaVersion:1,planId:p.id,candidateId:c.id,assignmentIndex:a.index,context:fixtureContext,experiment:{...e,postState:{[p.primaryMetric]:pre+delta}}};
  }
  p.status='completed';return validatePlan(p);
}
