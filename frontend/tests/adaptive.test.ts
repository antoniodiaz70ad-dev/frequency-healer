import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adaptiveFixture, adaptiveContext } from './adaptive-fixtures';
import { personalize } from '../src/lib/personalization/ranking';
import { suggestNext, validateSuggestion, compatibleAdaptiveBasis } from '../src/lib/adaptive/policy';
import { AdaptiveExperimentStore, ADAPTIVE_EXPERIMENTS_KEY, adaptiveFollowups, validateAdaptiveExperiment, type AdaptiveExperimentV1 } from '../src/lib/adaptive/storage';
import { prepareExperimentV2, transitionExperimentV2 } from '../src/lib/experiments/v2';
async function fixture(counts:number[],options:Parameters<typeof adaptiveFixture>[1]={}){const plans=await adaptiveFixture(counts,options),basis=await personalize(plans,plans[0].id,adaptiveContext);return {plans,basis,s:await suggestNext(basis)};}
async function audit(s:Awaited<ReturnType<typeof suggestNext>>,id:string,status:'completed'|'cancelled'|'interrupted'='completed'):Promise<AdaptiveExperimentV1>{
  const c=s.candidates.find(c=>c.candidateId===id)!.candidate;
  let e=await prepareExperimentV2(c.config,{intention:s.basis.intent.intent.intention,preState:{energy:0},expectationScore:0,context:JSON.stringify(s.basis.context)},c.constellation);
  e=transitionExperimentV2(transitionExperimentV2(e,'started'),status);
  return validateAdaptiveExperiment({schemaVersion:1,suggestion:s,chosenCandidateId:id,suggestionFollowed:s.suggestedNextCandidateId===id,experiment:{...e,postState:{energy:1}}});
}
test('Adaptive zero evidence A/B/C: deterministic original order, absent summaries and no invented best',async()=>{
  const {s,basis}=await fixture([0,0,0]);assert.equal(s.reason,'no-personal-evidence');assert.equal(s.suggestedNextCandidateId,'candidate-0');assert.equal(s.currentBestCandidateId,undefined);assert.ok(s.candidates.every(c=>c.change.mean===null&&c.spread===null));assert.deepEqual(await suggestNext(basis),s);assert.deepEqual(await validateSuggestion(s),s);
});
for(const [counts,chosen,reason] of [[[12,2,4],'candidate-1','insufficient-sample'],[[15,5,10],'candidate-1','candidate-imbalance'],[[10,3],'candidate-1','insufficient-sample']] as const)test(`Adaptive ${counts}: floor/imbalance precede promising mean`,async()=>{
  const {s}=await fixture([...counts]);assert.equal(s.reason,reason);assert.equal(s.suggestedNextCandidateId,chosen);if(counts[1]===3)assert.equal(s.currentBestCandidateId,undefined);
});
test('Balanced signal confirms Phase 2D best without changing its ranking; high variability can suggest another candidate',async()=>{
  const {s,basis}=await fixture([10,10,10]);const bytes=JSON.stringify(basis);assert.equal(s.currentBestCandidateId,'candidate-2');assert.equal(s.suggestedNextCandidateId,'candidate-2');assert.equal(s.reason,'confirm-current-signal');await suggestNext(basis);assert.equal(JSON.stringify(basis),bytes);
  const {s:uncertain}=await fixture([10,10],{deltas:[Array(10).fill(3),[0,1,1,1,1,1,1,1,1,5]]});assert.equal(uncertain.currentBestCandidateId,'candidate-0');assert.equal(uncertain.suggestedNextCandidateId,'candidate-1');assert.equal(uncertain.reason,'uncertainty-reduction');assert.equal(uncertain.candidates[1].spread,5);
});
test('Variable current signal is explicitly confirmed; differing expectations receive uncertainty wording',async()=>{
  const {s}=await fixture([10,10],{deltas:[Array(10).fill(1),[0,3,3,3,3,3,3,3,3,6]]});assert.equal(s.reason,'confirm-current-signal');assert.equal(s.explanation.criterion,'current-best-variable-positive-signal');
  const {s:e}=await fixture([10,10],{expectations:[Array(10).fill(0),Array(10).fill(8)]});assert.equal(e.currentBestCandidateId,undefined);assert.equal(e.explanation.expectationConfound,true);assert.equal(e.reason,'uncertainty-reduction');assert.equal(e.explanation.criterion,'expectation-confound-lowest-N');
});
test('Missing pairs, explicit zero, cancellation/interruption and context mismatches stay separate',async()=>{
  const plans=structuredClone(await adaptiveFixture([10,10]));const p=plans[0];Object.assign(p.assignments[0].result!.experiment,{postState:{energy:0}});Object.assign(p.assignments[2].result!.experiment,{preState:{}});
  for(const [i,status] of [[4,'cancelled'],[6,'interrupted']] as const){const a=p.assignments[i];a.status=status;const {completedAt,...e}=a.result!.experiment;void completedAt;a.result!.experiment={...e,status};}p.assignments[8].result!.context={};
  const s=await suggestNext(await personalize(plans,p.id,adaptiveContext)),c=s.candidates[0];assert.equal(c.comparableN,6);assert.equal(c.cancelledCount,1);assert.equal(c.interruptedCount,1);assert.equal(c.incompletePairCount,1);assert.equal(c.change.min,0);assert.equal(c.provenance.find(p=>p.experimentId.endsWith('-2'))!.pre,undefined);
});
test('Invalid candidate, unsupported playback, medical framing and tampered policy cannot be suggested',async()=>{
  const {basis}=await fixture([10,10]);const bad=structuredClone(basis);bad.sourcePlans[0].candidates[0].config.baseHz=999;await assert.rejects(suggestNext(bad));
  const medical=structuredClone(basis);medical.intent.rawText='curar dolor';medical.sourcePlans[0].intent.rawText='curar dolor';await assert.rejects(suggestNext(medical));
  const s=structuredClone(await suggestNext(basis));s.suggestedNextCandidateId='invalid';await assert.rejects(validateSuggestion(s));
  const unsupported=structuredClone(basis);unsupported.sourcePlans[0].candidates[0].config.mode='simultaneous';unsupported.sourcePlans[0].candidates[0].config.progression=Array(10).fill('root');await assert.rejects(suggestNext(unsupported));
});
test('Active fixed plan and original assignment order never change; only completed eligible snapshots enter suggestion',async()=>{
  const {plans,basis}=await fixture([10,10]),active=structuredClone(plans[0]);active.id='active';active.status='active';active.assignments=active.assignments.map(a=>({index:a.index,candidateId:a.candidateId,status:'pending'}));const before=JSON.stringify(active);
  assert.deepEqual(await personalize([...plans,active],plans[0].id,adaptiveContext),basis);await suggestNext(basis);assert.equal(JSON.stringify(active),before);
});
test('HIP/HCI is coverage only: high-HCI candidate never jumps original no-evidence priority; snapshots survive deletion',async()=>{
  const {s}=await fixture([0,0],{constellation:true,singleFirst:true});assert.ok(s.candidates[1].structure.hci.score>s.candidates[0].structure.hci.score);assert.equal(s.suggestedNextCandidateId,'candidate-0');assert.equal(s.coverage.filter(c=>c.dimension==='hciBands').length,2);
  const renamed=structuredClone(s.basis);renamed.sourcePlans[0].candidates[0].constellation={...renamed.sourcePlans[0].candidates[0].constellation!,name:'renamed'};assert.deepEqual(await validateSuggestion(s),s);assert.deepEqual(s.candidates[0].candidate.constellation,s.basis.sourcePlans[0].candidates[0].constellation);
});
test('Accept or override: exact audit, export/reload, zero, no legacy writes and no compliance weighting',async()=>{
  const {s,basis}=await fixture([0,0],{constellation:true});const legacy=new Map([['fh:experiment-sessions-v1','old-v1'],['fh:experiment-sessions-v2','old-v2'],['fh:protocol-discovery-plans-v1','old-plans']]),data=new Map(legacy);
  const store=new AdaptiveExperimentStore({getItem:k=>data.get(k)??null,setItem:(k,v)=>{assert.equal(k,ADAPTIVE_EXPERIMENTS_KEY);data.set(k,v);}},async op=>op());
  const chosen=await audit(s,'candidate-1');assert.equal(chosen.suggestionFollowed,false);await store.save(chosen);const rows=await store.load(),next=await suggestNext(basis,adaptiveFollowups(rows,basis));assert.equal(next.candidates[1].adaptiveN,1);assert.equal(next.candidates[1].provenance[0].pre,0);assert.equal(next.candidates[1].expectation.mean,0);assert.equal(next.suggestedNextCandidateId,'candidate-0');
  const accepted=await audit(next,'candidate-0');assert.equal(accepted.suggestionFollowed,true);await store.save(accepted);assert.equal((await store.load()).length,2);for(const [k,v]of legacy)assert.equal(data.get(k),v);
  assert.deepEqual(await validateAdaptiveExperiment(JSON.parse(JSON.stringify(chosen))),chosen);await assert.rejects(validateAdaptiveExperiment({...chosen,suggestionFollowed:true}));
  assert.deepEqual(await personalize(basis.sourcePlans,basis.anchorPlanId,basis.context),basis);
});
test('Additional results must match exact basis; duplicates and active records rejected; cancelled follow-ups do not increase N',async()=>{
  const {s,basis}=await fixture([0,0]),c=await audit(s,'candidate-0','cancelled'),i=await audit(s,'candidate-1','interrupted');const followups=adaptiveFollowups([c,i],basis),next=await suggestNext(basis,followups);assert.deepEqual(next.candidates.map(c=>c.comparableN),[0,0]);assert.equal(next.candidates[0].cancelledCount,1);assert.equal(next.candidates[1].interruptedCount,1);
  await assert.rejects(suggestNext(basis,[followups[0],followups[0]]));const wrong=structuredClone(followups[0]);Object.assign(wrong.experiment,{context:'{}'});await assert.rejects(suggestNext(basis,[wrong]));
  const started=structuredClone(followups[0]);Object.assign(started.experiment,{status:'started'});await assert.rejects(suggestNext(basis,[started]));
  const other=structuredClone(basis);other.targetMetric='focus';assert.equal(compatibleAdaptiveBasis(basis,other),false);
});
test('Corrupt audits, conflicting IDs, quota and concurrent mutation do not overwrite saved data',async()=>{
  const {s}=await fixture([0,0]),value=await audit(s,'candidate-0');
  for(const raw of ['{bad','{}'])await assert.rejects(new AdaptiveExperimentStore({getItem:()=>raw,setItem:()=>assert.fail('overwrite')},async op=>op()).save(value));
  let raw:string|null=null;const store=new AdaptiveExperimentStore({getItem:()=>raw,setItem:(_k,v)=>{raw=v;}},async op=>op());await store.save(value);const before=raw;await assert.rejects(store.save({...value,experiment:{...value.experiment,reflection:'conflict'}}));assert.equal(raw,before);
  await assert.rejects(new AdaptiveExperimentStore({getItem:()=>null,setItem:()=>{throw Error('quota');}},async op=>op()).save(value),/quota/);
  let reads=0;await assert.rejects(new AdaptiveExperimentStore({getItem:()=>++reads===1?null:'[]',setItem:()=>assert.fail('race overwrite')},async op=>op()).save(value),/cambió/);
});
