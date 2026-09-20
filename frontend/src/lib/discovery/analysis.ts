import type { ProtocolDiscoveryPlanV1, TargetMetric, DiscoveryContextV1 } from './model';
export const contextKey=(context:DiscoveryContextV1)=>JSON.stringify([context.tags?[...context.tags].sort():null,context.device??null,context.timeOfDay??null]);
const mean=(v:number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:null;
export function statistics(values:number[]){const v=[...values].sort((a,b)=>a-b),n=v.length;return {n,mean:mean(v),median:n?(v[Math.floor((n-1)/2)]+v[Math.floor(n/2)])/2:null,min:n?v[0]:null,max:n?v[n-1]:null};}
export function evidenceState(n:number):'insufficient'|'exploratory'|'preliminary'|'descriptive'{return n<3?'insufficient':n<5?'exploratory':n<10?'preliminary':'descriptive';}
export function analyzePlan(plan:ProtocolDiscoveryPlanV1,stratum?:string){
  const metric:TargetMetric=plan.primaryMetric;
  const groups=[...new Set(plan.assignments.flatMap(a=>a.result?[contextKey(a.result.context)]:[]))];
  const rows=plan.candidates.map(candidate=>{
    const assigned=plan.assignments.filter(a=>a.candidateId===candidate.id);
    const observed=assigned.filter(a=>a.result&&(stratum===undefined||contextKey(a.result.context)===stratum));
    const completed=observed.filter(a=>a.result!.experiment.status==='completed');
    const paired=completed.flatMap(a=>{const e=a.result!.experiment,pre=e.preState[metric],post=e.postState[metric];return pre===undefined||post===undefined?[]:[{delta:post-pre,expectation:e.expectationScore!,pre}];});
    const attempted=assigned.filter(a=>a.attemptId!==undefined),resolved=attempted.filter(a=>a.status!=='reserved');
    const expectations=completed.flatMap(a=>a.result!.experiment.expectationScore===undefined?[]:[a.result!.experiment.expectationScore!]);
    // Pearson is descriptive only; require spread and ten complete paired observations.
    let expectationAssociation:number|null=null;
    if(paired.length>=10){const x=mean(paired.map(p=>p.expectation))!,y=mean(paired.map(p=>p.delta))!;const xx=paired.reduce((s,p)=>s+(p.expectation-x)**2,0),yy=paired.reduce((s,p)=>s+(p.delta-y)**2,0);if(xx>0&&yy>0)expectationAssociation=paired.reduce((s,p)=>s+(p.expectation-x)*(p.delta-y),0)/Math.sqrt(xx*yy);}
    return {candidateId:candidate.id,metadata:candidate.metadata,completed:completed.length,change:statistics(paired.map(p=>p.delta)),baseline:statistics(paired.map(p=>p.pre)),expectationAverage:mean(expectations),expectationAssociation,evidence:evidenceState(paired.length),completionRate:resolved.length?assigned.filter(a=>a.status==='completed').length/resolved.length:null,attempted:attempted.length,skipped:assigned.filter(a=>a.status==='skipped').length};
  });
  const minimum=Math.min(...rows.map(r=>r.change.n));
  return {metric,rows,groups,evidence:evidenceState(minimum),comparisonAvailable:minimum>=3&&(stratum!==undefined||groups.length<=1),mixedContext:stratum===undefined&&groups.length>1,
    limitations:'Cambio = después − antes; menor tensión y mayores otras escalas pueden ser la dirección deseada, no una conclusión causal. El contexto ausente no demuestra condiciones iguales. Expectativa y estado previo se registran, no se controlan. Tasa de finalización = completadas / intentos resueltos de todo el candidato, excluye omisiones y reservas abiertas. No se selecciona ganador ni se cambia la asignación.'};
}
