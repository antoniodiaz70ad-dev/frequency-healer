import { test } from 'node:test';
import assert from 'node:assert/strict';
import { personalFixture, fixtureContext } from './personalization-fixtures';
import { personalize, validatePersonalization } from '../src/lib/personalization/ranking';
import { validatePlan } from '../src/lib/discovery/model';
import { prepareExperimentV2, transitionExperimentV2 } from '../src/lib/experiments/v2';
import { PersonalizedExperimentStore, PERSONALIZED_EXPERIMENTS_KEY, validatePersonalizedExperiment } from '../src/lib/personalization/storage';
for(const n of [0,4,5,9,10,20])test(`Personalization N=${n}: deterministic thresholds, provenance, no mutation`,async()=>{
  const plans=n===20?[await personalFixture(10,{planId:'p1'}),await personalFixture(10,{planId:'p2'})]:[await personalFixture(n)];
  const bytes=JSON.stringify(plans);const r=await personalize(plans,plans[0].id,fixtureContext);
  assert.equal(r.evidenceLevel,n<5?'NONE':n<10?'PRELIMINARY':'DESCRIPTIVE');assert.equal(r.recommendations[0].comparableN,n);
  assert.deepEqual(r.orderedCandidateIds,n<10?['candidate-0','candidate-1']:['candidate-1','candidate-0']);
  assert.equal(r.recommendations[0].personalizationScore,n<5?0:n<10?n/10:2);
  assert.deepEqual(await personalize([...plans].reverse(),plans[0].id,fixtureContext),r);assert.deepEqual(await validatePersonalization(r),r);assert.equal(JSON.stringify(plans),bytes);
  assert.ok(r.recommendations.every(row=>row.provenance.length===n));
});
test('Missing/zero/cancelled/interrupted/context exclusions never broaden comparability',async()=>{
  const p=structuredClone(await personalFixture());
  const first=p.assignments[0].result!;Object.assign(first.experiment,{postState:{energy:0}});
  Object.assign(p.assignments[2].result!.experiment,{preState:{}});
  for(const [index,status] of [[4,'cancelled'],[6,'interrupted']] as const){const a=p.assignments[index];a.status=status;const e=a.result!.experiment;const {completedAt,...rest}=e;void completedAt;a.result!.experiment={...rest,status};}
  p.assignments[8].result!.context={device:'speaker'};
  const checked=await validatePlan(p),r=await personalize([checked],p.id,fixtureContext);const a=r.recommendations.find(r=>r.candidateId==='candidate-0')!;
  assert.equal(a.comparableN,6);assert.equal(a.terms.improvingSessions,5);assert.equal(a.descriptiveMetrics.change.min,0);assert.equal(a.descriptiveMetrics.baseline.min,0);assert.equal(r.orderingApplied,false);
  const other=await personalFixture(10,{planId:'other',metric:'focus'});assert.equal((await personalize([checked,other],p.id,fixtureContext)).sourcePlans.length,1);
});
test('Expectation gap is surfaced and prevents ordering, never enters score',async()=>{
  const p=await personalFixture(10,{expectations:[Array(10).fill(2),Array(10).fill(8)]}),r=await personalize([p],p.id,fixtureContext);
  assert.equal(r.expectationDifference,6);assert.ok(r.expectationConfound);assert.equal(r.reason,'expectation-confound');assert.deepEqual(r.orderedCandidateIds,r.defaultOrder);assert.equal(r.recommendations[1].personalizationScore,2);
});
test('Median and consistency stop an extreme session dominating repeated positive responses',async()=>{
  const p=await personalFixture(10,{deltas:[[0,0,0,0,0,0,0,0,0,10],Array(10).fill(0.8)]}),r=await personalize([p],p.id,fixtureContext);
  assert.equal(r.recommendations[0].candidateId,'candidate-1');assert.equal(r.recommendations[1].descriptiveMetrics.change.mean,1);assert.equal(r.recommendations[1].personalizationScore,0);
});
test('Tension is inverse; primary metric alone determines score, negative outcomes get no positive priority',async()=>{
  const p=await personalFixture(10,{metric:'tension',deltas:[Array(10).fill(-1),Array(10).fill(-2)]}),r=await personalize([p],p.id,fixtureContext);
  assert.equal(r.recommendations[0].candidateId,'candidate-1');assert.equal(r.recommendations[0].direction,-1);assert.equal(r.recommendations[0].descriptiveMetrics.change.median,-2);assert.equal(r.recommendations[0].personalizationScore,2);
  const bad=await personalFixture(10,{deltas:[Array(10).fill(-1),Array(10).fill(-2)]});assert.equal((await personalize([bad],bad.id,fixtureContext)).reason,'no-positive-signal');
});
test('Changed comparable evidence produces explained order change; ties keep original order',async()=>{
  const a=await personalFixture(10,{deltas:[Array(10).fill(3),Array(10).fill(1)]}),r=await personalize([a],a.id,fixtureContext);assert.equal(r.orderedCandidateIds[0],'candidate-0');assert.equal(r.recommendations[0].terms.outcomeSignal,3);
  const b=await personalFixture(10,{deltas:[Array(10).fill(1),Array(10).fill(3)]});assert.equal((await personalize([b],b.id,fixtureContext)).orderedCandidateIds[0],'candidate-1');
  const tie=await personalFixture(10,{deltas:[Array(10).fill(1),Array(10).fill(1)]});assert.deepEqual((await personalize([tie],tie.id,fixtureContext)).orderedCandidateIds,['candidate-0','candidate-1']);
});
test('Invalid candidate/evidence/score rejected; active or different intent/set not pooled; no duplicate N',async()=>{
  const p=await personalFixture();const bad=structuredClone(p);bad.candidates[0].config.baseHz=999;await assert.rejects(personalize([bad],bad.id,fixtureContext));
  const r=structuredClone(await personalize([p],p.id,fixtureContext));r.recommendations[0].personalizationScore=100;await assert.rejects(validatePersonalization(r));
  const duplicate=structuredClone(p);duplicate.id='duplicate';duplicate.assignments.forEach(a=>{if(a.result)a.result.planId=duplicate.id;});await assert.rejects(personalize([p,duplicate],p.id,fixtureContext),/repetido/);
  const other=await personalFixture(10,{planId:'focus-plan',words:'Quiero enfoque 5 minutos'});assert.equal((await personalize([p,other],p.id,fixtureContext)).sourcePlans.length,1);
  const active=structuredClone(p);active.status='active';active.assignments[active.assignments.length-1]={index:active.assignments.length-1,candidateId:'candidate-1',status:'pending'};await assert.rejects(personalize([active],active.id,fixtureContext),/completado/);
});
test('Constellation identity survives absent source; either choice saves auditable V2 without legacy writes',async()=>{
  const p=await personalFixture(10,{constellation:true}),recommendation=await personalize([p],p.id,fixtureContext);
  const data=new Map([['fh:experiment-sessions-v1','legacy-v1'],['fh:experiment-sessions-v2','legacy-v2'],['fh:protocol-discovery-plans-v1',JSON.stringify([p])]]);
  const store=new PersonalizedExperimentStore({getItem:k=>data.get(k)??null,setItem:(k,v)=>{assert.equal(k,PERSONALIZED_EXPERIMENTS_KEY);data.set(k,v);}},async op=>op());
  for(const selected of recommendation.recommendations){let experiment=await prepareExperimentV2(selected.candidate.config,{intention:p.intent.intent.intention,preState:{energy:0},expectationScore:0,context:JSON.stringify(fixtureContext)},selected.candidate.constellation);experiment=transitionExperimentV2(transitionExperimentV2(experiment,'started'),'cancelled');
    const saved=await validatePersonalizedExperiment({schemaVersion:1,recommendation,selectedCandidateId:selected.candidateId,experiment});await store.save(saved);assert.deepEqual(saved.experiment.constellation!.snapshot,selected.candidate.constellation);
  }
  assert.equal((await store.load()).length,2);assert.equal(data.get('fh:experiment-sessions-v1'),'legacy-v1');assert.equal(data.get('fh:experiment-sessions-v2'),'legacy-v2');assert.equal(data.get('fh:protocol-discovery-plans-v1'),JSON.stringify([p]));
  const raw=data.get(PERSONALIZED_EXPERIMENTS_KEY)!;assert.deepEqual(await Promise.all(JSON.parse(raw).map(validatePersonalizedExperiment)),await store.load());
});
test('Corrupt personalized history preserved; conflicting IDs and quota errors never overwrite',async()=>{
  const p=await personalFixture(0),recommendation=await personalize([p],p.id,fixtureContext),selected=recommendation.recommendations[0];const experiment=await prepareExperimentV2(selected.candidate.config,{intention:p.intent.intent.intention,preState:{},expectationScore:0,context:JSON.stringify(fixtureContext)});
  const value={schemaVersion:1,recommendation,selectedCandidateId:selected.candidateId,experiment};
  for(const raw of ['{bad','{}']){const store=new PersonalizedExperimentStore({getItem:()=>raw,setItem:()=>assert.fail('No overwrite')},async op=>op());await assert.rejects(store.save(value));}
  let raw:string|null=null;const store=new PersonalizedExperimentStore({getItem:()=>raw,setItem:(_k,v)=>{raw=v;}},async op=>op());await store.save(value);const original=raw;await assert.rejects(store.save({...value,experiment:{...experiment,reflection:'conflict'}}));assert.equal(raw,original);
  const quota=new PersonalizedExperimentStore({getItem:()=>null,setItem:()=>{throw new Error('quota');}},async op=>op());await assert.rejects(quota.save(value),/quota/);
  let reads=0;const raced=new PersonalizedExperimentStore({getItem:()=>++reads===1?null:'[]',setItem:()=>assert.fail('No race overwrite')},async op=>op());await assert.rejects(raced.save(value),/cambió/);
});
test('Focus ranking uses focus alone; secondary energy cannot redefine the reviewed metric',async()=>{
  const p=structuredClone(await personalFixture(10,{metric:'focus',words:'Quiero enfoque 5 minutos',deltas:[Array(10).fill(2),Array(10).fill(1)]}));
  for(const a of p.assignments){const e=a.result!.experiment;Object.assign(e,{preState:{...e.preState,energy:0},postState:{...e.postState,energy:a.candidateId==='candidate-1'?10:0}});}
  const r=await personalize([p],p.id,fixtureContext);
  assert.equal(r.targetMetric,'focus');assert.equal(r.recommendations[0].candidateId,'candidate-0');assert.equal(r.recommendations[0].personalizationScore,2);
  assert.equal(r.recommendations[1].personalizationScore,1);
});
