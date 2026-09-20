import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretGuidedIntent, recommendGuided } from '../src/lib/guided/recommendations';
import { candidate, createPlan, validatePlan, validateCandidate, assignmentOrder, nextAssignment, type ProtocolDiscoveryPlanV1 } from '../src/lib/discovery/model';
import { DiscoveryStore, DISCOVERY_KEY, type DiscoveryLock } from '../src/lib/discovery/storage';
import { analyzePlan, contextKey, statistics } from '../src/lib/discovery/analysis';
import { prepareExperimentV2, transitionExperimentV2 } from '../src/lib/experiments/v2';
import { compileConstellation } from '../src/lib/harmonic/constellations';
const intent=interpretGuidedIntent('Quiero evitar drenaje energético 5 minutos');
const base=recommendGuided(intent).proposal.harmonicConfig;
export async function fixture(rounds=3,saved=false){
  const candidates=await Promise.all([144,220].map(async(seed,i)=>candidate(intent,`c${i}`,`Protocol ${i}`,{...base,baseHz:seed,...(saved?{durationSeconds:1}: {})},saved?await compileConstellation({id:`source-${i}`,name:`Original ${i}`,seedFrequencyHz:seed,playbackMode:'sequence',members:[{id:'r',relationshipType:'root'},{id:'f',relationshipType:'ratio',ratio:{numerator:3,denominator:2}}]}):undefined)));
  return createPlan({intent,primaryMetric:'energy',candidates,assignmentStrategy:'balanced',randomSeed:42,minimumSessionsPerCandidate:rounds});
}
function memory(raw?:string){const data=new Map<string,string>(raw===undefined?[]:[[DISCOVERY_KEY,raw]]);let queue=Promise.resolve();const lock:DiscoveryLock=op=>{const p=queue.then(op);queue=p.then(()=>{},()=>{});return p;};const store=new DiscoveryStore({getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);}},lock);return {data,store};}
async function execute(store:DiscoveryStore,p:ProtocolDiscoveryPlanV1,status:'completed'|'cancelled'|'interrupted'='completed',missing=false,expectation=0,context={}){
  const a=nextAssignment(p)!,c=p.candidates.find(c=>c.id===a.candidateId)!;
  let e=await prepareExperimentV2(c.config,{preState:missing?{}:{energy:0},intention:p.intent.intent.intention,expectationScore:expectation},c.constellation);
  p=(await store.act(p,{kind:'reserve',attemptId:e.id}))[0];e=transitionExperimentV2(transitionExperimentV2(e,'started'),status);
  const experiment={...e,postState:missing?{}:{energy:2}};
  return (await store.act(p,{kind:'save',result:{schemaVersion:1,planId:p.id,candidateId:c.id,assignmentIndex:a.index,context,experiment}}))[0];
}
test('Discovery creates validated immutable plans; seed/ratio/mode/order metadata preserved',async()=>{
  const p=await fixture();assert.equal(p.status,'draft');assert.deepEqual(p.assignments.map(a=>a.candidateId),['c0','c1','c0','c1','c0','c1']);
  assert.equal(p.candidates[1].metadata.seedFrequencyHz,220);assert.deepEqual(p.candidates[0].metadata.ratios,['6:5','4:3','1:1']);assert.equal(p.candidates[0].metadata.playbackMode,'sequence');assert.ok(Object.isFrozen(p.candidates[0].config));assert.deepEqual(await validatePlan(p),p);
});
test('Discovery rejects invalid candidates, confounds, duplicate architecture, metadata and order tampering',async()=>{
  const p=await fixture();await assert.rejects(candidate(intent,'x','x',{...base,baseHz:1999}));
  for(const patch of [{metadata:{...p.candidates[0].metadata,seedFrequencyHz:400}},{config:{...p.candidates[0].config,uiVolume:101}},{ruleId:'invented'}])await assert.rejects(validateCandidate({...p.candidates[0],...patch},intent));
  const copy=structuredClone(p);copy.assignments.reverse();await assert.rejects(validatePlan(copy));
  await assert.rejects(createPlan({...p,candidates:[p.candidates[0],{...p.candidates[0],id:'other',label:'Other'}]}));
  const volume=await candidate(intent,'third','Third',{...base,baseHz:220,uiVolume:50});await assert.rejects(createPlan({...p,candidates:[p.candidates[0],volume]}));
});
test('Randomized balanced assignment is reproducible and balanced per block',()=>{
  const ids=['A','B','C'],one=assignmentOrder(ids,10,'randomized-balanced',42);assert.deepEqual(one,assignmentOrder(ids,10,'randomized-balanced',42));assert.notDeepEqual(one,assignmentOrder(ids,10,'randomized-balanced',43));for(let n=0;n<one.length;n+=3)assert.deepEqual(one.slice(n,n+3).sort(),ids);assert.throws(()=>assignmentOrder(ids,2,'balanced',0));
});
test('Skip remains skipped, reserve before play, stale preview rejected and interruption never completed',async()=>{
  const {store}=memory();let p=(await store.create(await fixture()))[0];p=(await store.act(p,{kind:'activate'}))[0];const preview=p;
  p=(await store.act(p,{kind:'skip'}))[0];assert.equal(p.assignments[0].status,'skipped');await assert.rejects(store.act(preview,{kind:'reserve',attemptId:'race'}));
  p=(await store.act(p,{kind:'reserve',attemptId:'interrupted'}))[0];assert.equal(p.assignments[1].result,undefined);
  p=(await store.act(p,{kind:'interrupt'}))[0];assert.equal(p.assignments[1].status,'interrupted');assert.equal(p.assignments[1].result,undefined);assert.equal(nextAssignment(p)!.index,2);
});
for(const n of [3,5,10])test(`Descriptive comparison N=${n}, exact context/pre/post/expectation and V2 identity`,async()=>{
  const {store}=memory();let p=(await store.create(await fixture(n,true)))[0];p=(await store.act(p,{kind:'activate'}))[0];for(let i=0;i<n*2;i++)p=await execute(store,p,'completed',false,0,{tags:['after-work'],device:'headphones',timeOfDay:'evening'});
  assert.equal(p.status,'completed');const s=analyzePlan(p);assert.equal(s.evidence,n===3?'exploratory':n===5?'preliminary':'descriptive');assert.ok(s.comparisonAvailable);assert.equal(s.rows[0].change.mean,2);assert.equal(s.rows[0].expectationAverage,0);assert.equal(s.rows[0].expectationAssociation,null);
  assert.deepEqual(p.assignments[0].result!.experiment.constellation!.snapshot,p.candidates[0].constellation);assert.equal(p.assignments[0].result!.experiment.preState.energy,0);assert.deepEqual(await validatePlan(JSON.parse(JSON.stringify(p))),p);
});
test('Missing observations never become zero; cancelled excluded; mixed contexts are not pooled',async()=>{
  const {store}=memory();let p=(await store.create(await fixture()))[0];p=(await store.act(p,{kind:'activate'}))[0];p=await execute(store,p,'completed',true);p=await execute(store,p,'cancelled');p=await execute(store,p,'completed',false,8,{device:'speaker'});
  const s=analyzePlan(p);assert.equal(s.rows[0].completed,2);assert.equal(s.rows[0].change.n,1);assert.equal(s.rows[1].completed,0);assert.equal(s.rows[1].change.mean,null);assert.equal(s.rows[1].completionRate,0);assert.ok(s.mixedContext);assert.equal(s.comparisonAvailable,false);assert.equal(analyzePlan(p,contextKey({})).rows[0].change.n,0);assert.equal(s.evidence,'insufficient');assert.deepEqual(statistics([]),{n:0,mean:null,median:null,min:null,max:null});
});
test('Source rename/deletion does not rewrite saved plan; signatures/configuration tampering rejected',async()=>{
  const p=await fixture(3,true);const source=structuredClone(p.candidates[0].constellation!);Object.assign(source,{name:'renamed'});assert.notEqual(p.candidates[0].constellation!.name,source.name);assert.deepEqual(await validatePlan(p),p);
  const bad=structuredClone(p);Object.assign(bad.candidates[0].constellation!,{signature:'sha256:bad'});await assert.rejects(validatePlan(bad));
});
test('Corrupted storage, duplicate IDs and concurrent stale writes preserve original bytes/legacy keys',async()=>{
  for(const raw of ['{bad','{}',JSON.stringify([{schemaVersion:999}])]){const {data,store}=memory(raw);await assert.rejects(store.create(await fixture()));assert.equal(data.get(DISCOVERY_KEY),raw);}
  const {data,store}=memory();data.set('fh:experiment-sessions-v1','legacy-v1');data.set('fh:experiment-sessions-v2','legacy-v2');let p=(await store.create(await fixture()))[0];await assert.rejects(store.create(p));p=(await store.act(p,{kind:'activate'}))[0];const results=await Promise.allSettled([store.act(p,{kind:'skip'}),store.act(p,{kind:'skip'})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(data.get('fh:experiment-sessions-v1'),'legacy-v1');assert.equal(data.get('fh:experiment-sessions-v2'),'legacy-v2');
});
test('Assignment result identity, lifecycle and config cannot be substituted',async()=>{
  const {store}=memory();let p=(await store.create(await fixture()))[0];p=(await store.act(p,{kind:'activate'}))[0];p=await execute(store,p);const bad=structuredClone(p);bad.assignments[0].result!.candidateId='c1';await assert.rejects(validatePlan(bad));
  const interrupted=structuredClone(p);interrupted.assignments[0].status='interrupted';await assert.rejects(validatePlan(interrupted));
});
test('Expectation association needs ten varying paired observations; never changes candidate order',async()=>{
  const {store}=memory();let p=(await store.create(await fixture(10)))[0];p=(await store.act(p,{kind:'activate'}))[0];const order=p.assignments.map(a=>a.candidateId);
  for(let i=0;i<20;i++){
    const a=nextAssignment(p)!,c=p.candidates.find(c=>c.id===a.candidateId)!,score=Math.floor(i/2);
    let e=await prepareExperimentV2(c.config,{preState:{energy:0},intention:p.intent.intent.intention,expectationScore:score});p=(await store.act(p,{kind:'reserve',attemptId:e.id}))[0];e=transitionExperimentV2(transitionExperimentV2(e,'started'),'completed');
    p=(await store.act(p,{kind:'save',result:{schemaVersion:1,planId:p.id,candidateId:c.id,assignmentIndex:a.index,context:{},experiment:{...e,postState:{energy:score}}}}))[0];
    if(i<18)assert.equal(analyzePlan(p).rows[0].expectationAssociation,null);
  }
  assert.equal(analyzePlan(p).rows[0].expectationAssociation,1);assert.deepEqual(p.assignments.map(a=>a.candidateId),order);
});
test('Four paired observations remain exploratory; quotas and raw-storage races never overwrite',async()=>{
  const {store}=memory();let p=(await store.create(await fixture(4)))[0];p=(await store.act(p,{kind:'activate'}))[0];for(let i=0;i<8;i++)p=await execute(store,p);assert.equal(analyzePlan(p).evidence,'exploratory');
  const original=JSON.stringify([p]);const quota=new DiscoveryStore({getItem:()=>original,setItem:()=>{throw new Error('quota');}},async op=>op());await assert.rejects(quota.create(await fixture()),/quota/);
  let reads=0;const race=new DiscoveryStore({getItem:()=>++reads===1?'[]':'changed',setItem:()=>assert.fail('No overwrite')},async op=>op());await assert.rejects(race.create(await fixture()),/cambiaron/);
});
