import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileConstellation, type HarmonicRelationshipV1 } from '../src/lib/harmonic/constellations';
import { buildSchedule, type HarmonicConfig } from '../src/lib/harmonic/math';
import { describeHarmonics, HCI_VERSION, type StructureSource } from '../src/lib/harmonic/profile/profile';
import { analyzeStructure, STRUCTURAL_GROUPS } from '../src/lib/harmonic/profile/analysis';
import { personalize } from '../src/lib/personalization/ranking';
import { personalFixture, fixtureContext } from './personalization-fixtures';
import { candidate, createPlan, type ProtocolDiscoveryPlanV1 } from '../src/lib/discovery/model';
import { prepareExperimentV2, transitionExperimentV2 } from '../src/lib/experiments/v2';

const config:HarmonicConfig={baseHz:432,ratioId:'root',progression:['root'],increments:3,direction:'ascending',mode:'sequence',durationSeconds:60,uiVolume:0,waveform:'sine'};
const root=(id:string):HarmonicRelationshipV1=>({id,relationshipType:'root'});
const ratio=(id:string,n:number,d:number):HarmonicRelationshipV1=>({id,relationshipType:'ratio',ratio:{numerator:n,denominator:d}});
const octave=(id:string,octaveOffset:number):HarmonicRelationshipV1=>({id,relationshipType:'octave',octaveOffset});
async function source(members:HarmonicRelationshipV1[],mode:'sequence'|'simultaneous'='sequence'):Promise<StructureSource>{return {sourceType:'harmonic-constellation',constellation:await compileConstellation({id:'profile-test',seedFrequencyHz:432,members,playbackMode:mode})};}
const profile=async(members:HarmonicRelationshipV1[],mode:'sequence'|'simultaneous'='sequence')=>describeHarmonics(await source(members,mode));

test('HIP single tone and HCI zero; explicit version, no invented octave relationships',async()=>{
  const v=await describeHarmonics({sourceType:'legacy-harmonic-config',configuration:config});
  assert.equal(v.hip.memberCount,1);assert.equal(v.hip.uniqueMemberCount,1);assert.equal(v.hip.spectralSpanHz,0);assert.equal(v.hip.octaveSpan,0);
  assert.deepEqual(v.hip.octaveOffsets,[]);assert.equal(v.hip.explicitOctaveOffsetSpan,null);assert.equal(v.hci.score,0);assert.equal(v.hci.algorithmVersion,HCI_VERSION);
  assert.deepEqual(v.hci, (await profile([root('different-id')])).hci);
});
test('HIP examples A/B/C: exact members, ratio diversity, explicit octave, bounded explainable HCI',async()=>{
  const a=await profile([root('r')]),b=await profile([root('r'),ratio('f',3,2)]),c=await profile([root('r'),ratio('t',5,4),ratio('f',3,2),octave('o',1)]);
  assert.deepEqual(c.hip.members.map(m=>m.frequencyHz),[432,540,648,864]);assert.equal(c.hip.memberCount,4);assert.equal(c.hip.uniqueFrequencyCount,4);
  assert.equal(c.hip.ratioCount,2);assert.equal(c.hip.ratioDiversity,2);assert.deepEqual(c.hip.ratioFamilies,['3:2','5:4']);assert.equal(c.hip.octaveCount,1);assert.deepEqual(c.hip.octaveOffsets,[1]);
  assert.equal(c.hip.octaveSpan,1);assert.equal(c.hip.explicitOctaveOffsetSpan,0);assert.equal(c.hip.spectralSpanHz,432);
  assert.ok(a.hci.score<b.hci.score&&b.hci.score<c.hci.score);assert.equal(c.hci.score,25*(0.75+0.75+1/Math.log2(50)+1));assert.equal(c.hci.band,'higher');
});
test('HIP duplicate occurrences preserved; exact relationship equivalents do not inflate diversity',async()=>{
  const v=await profile([root('a'),ratio('b',1,1),octave('c',0),ratio('d',6,4),ratio('e',3,2)]);
  assert.equal(v.hip.memberCount,5);assert.equal(v.hip.uniqueMemberCount,2);assert.equal(v.hip.uniqueRelationshipCount,2);assert.equal(v.hip.duplicateVoiceCount,3);
  assert.deepEqual(v.hip.frequencyMultiplicity,[{frequencyHz:432,count:3},{frequencyHz:648,count:2}]);assert.equal(v.hip.ratioDiversity,2);
  assert.equal(v.hci.adjacentChanges,1);assert.equal(v.hci.terms.order,1/4);
  assert.equal((await profile([root('a'),root('b')])).hci.score,12.5);
});
test('Explicit octaves and ratio powers agree in HCI without relabeling stored member types',async()=>{
  const a=await profile([octave('a',-1),root('b'),octave('c',1)]),b=await profile([ratio('a',1,2),ratio('b',1,1),ratio('c',2,1)]);
  assert.deepEqual(a.hci,b.hci);assert.equal(a.hip.octaveSpan,2);assert.equal(a.hip.explicitOctaveOffsetSpan,2);assert.deepEqual(a.hip.members.map(m=>m.frequencyHz),[216,432,864]);assert.equal(b.hip.octaveCount,0);assert.equal(b.hip.ratioCount,3);
});
test('Sequence adjacency affects HCI deliberately; simultaneous permutations and names never do',async()=>{
  const members=[root('a'),root('b'),ratio('c',3,2)],other=[members[0],members[2],members[1]];
  const a=await profile(members),b=await profile(other);assert.equal(a.hci.terms.order,0.5);assert.equal(b.hci.terms.order,1);assert.equal(b.hci.score-a.hci.score,12.5);
  assert.deepEqual((await profile(members,'simultaneous')).hci,(await profile(other,'simultaneous')).hci);
  const s=await source(members);if(s.sourceType!=='harmonic-constellation')throw Error('fixture');const before=await describeHarmonics(s);
  assert.deepEqual(await describeHarmonics({...s,constellation:{...s.constellation,name:'Renamed',id:'new-id'}}),before);
  assert.ok(Object.isFrozen(before.hip.members));
});
test('Legacy progression/cascade use exact schedule occurrences, including return repeats',async()=>{
  for(const direction of ['ascending','descending','return'] as const){const c={...config,baseHz:300,ratioId:'cascade-13-12' as const,progression:undefined,direction};const expected=buildSchedule(c),v=await describeHarmonics({sourceType:'legacy-harmonic-config',configuration:c});
    assert.deepEqual(v.hip.members.map(m=>m.frequencyHz),expected.steps.flatMap(s=>s.frequencies));assert.deepEqual(v.hip.octaveOffsets,[]);assert.deepEqual(v.hip.ratioFamilies,['cascade-13-12']);assert.equal(v.hip.duplicateVoiceCount,direction==='return'?3:0);}
  const v=await describeHarmonics({sourceType:'legacy-harmonic-config',configuration:{...config,progression:['root','fifth','root']}});assert.equal(v.hip.memberCount,3);assert.equal(v.hip.uniqueFrequencyCount,2);
});
test('HCI is deterministic and outcome-independent; duration/volume/name are not score inputs; source bytes unchanged',async()=>{
  const input={sourceType:'legacy-harmonic-config' as const,configuration:{...config,progression:['root','fifth'] as HarmonicConfig['progression']}};const bytes=JSON.stringify(input),a=await describeHarmonics(input);
  assert.deepEqual(await describeHarmonics(input),a);assert.equal(JSON.stringify(input),bytes);
  assert.deepEqual((await describeHarmonics({...input,configuration:{...input.configuration,durationSeconds:300,uiVolume:10}})).hci,a.hci);
  assert.deepEqual((await describeHarmonics({...input,subjectiveOutcome:10} as StructureSource)).hci,a.hci);
  await assert.rejects(describeHarmonics({...input,configuration:{...config,baseHz:0}}));
  const bad=await source([root('a')]);if(bad.sourceType==='harmonic-constellation')await assert.rejects(describeHarmonics({...bad,constellation:{...bad.constellation,signature:'sha256:bad'}}));
});
for(const n of [0,4,5,9,10,20])test(`Structural N=${n}: same eligible population, guarded association, seed strata and unchanged ranking`,async()=>{
  const plans=n===20?[await personalFixture(10,{planId:'a'}),await personalFixture(10,{planId:'b'})]:[await personalFixture(n)];
  const recommendation=await personalize(plans,plans[0].id,fixtureContext),bytes=JSON.stringify(recommendation);
  const report=await analyzeStructure(recommendation,'hciBand');assert.equal(report.groups.length,2,'Never pool different seeds');
  assert.ok(report.groups.every(g=>g.comparableN===n&&g.associationAvailable===(n>=10)));assert.equal(report.groups[0].evidenceLevel,n<5?'NONE':n<10?'PRELIMINARY':'DESCRIPTIVE');
  assert.equal(JSON.stringify(recommendation),bytes);assert.deepEqual(await personalize(plans,plans[0].id,fixtureContext),recommendation);
  assert.equal(report.algorithmVersion,HCI_VERSION);assert.deepEqual(await analyzeStructure(JSON.parse(JSON.stringify(recommendation)),'hciBand'),report);
});
test('Structural missing/zero/cancelled/interrupted/context exclusions match Phase 2D exactly',async()=>{
  const p=structuredClone(await personalFixture());Object.assign(p.assignments[0].result!.experiment,{postState:{energy:0}});Object.assign(p.assignments[2].result!.experiment,{preState:{}});
  for(const [index,status] of [[4,'cancelled'],[6,'interrupted']] as const){const a=p.assignments[index];a.status=status;const {completedAt,...e}=a.result!.experiment;void completedAt;a.result!.experiment={...e,status};}
  p.assignments[8].result!.context={};
  const r=await personalize([p],p.id,fixtureContext),report=await analyzeStructure(r,'memberCount');
  const row=report.groups.find(g=>g.candidateIds.includes('candidate-0'))!;assert.equal(row.comparableN,6);assert.equal(row.change.min,0);assert.equal(row.baseline.min,0);assert.equal(row.associationAvailable,false);
});
async function structuralPlan(expectationGap=false):Promise<ProtocolDiscoveryPlanV1>{
  const template=await personalFixture(),intent=template.intent;
  const c=await Promise.all([[root('r')],[root('r'),ratio('f',3,2)]].map(async(members,i)=>candidate(intent,`candidate-${i}`,`Protocol ${i}`,{...config,baseHz:432,durationSeconds:300},await compileConstellation({id:`struct-${i}`,seedFrequencyHz:432,playbackMode:'sequence',members}))));
  const p=structuredClone(await createPlan({intent,primaryMetric:'energy',candidates:c,assignmentStrategy:'balanced',randomSeed:42,minimumSessionsPerCandidate:10}));
  for(const a of p.assignments){const selected=c[a.index%2];let experiment=await prepareExperimentV2(selected.config,{intention:intent.intent.intention,preState:{energy:0},expectationScore:expectationGap?(a.index%2?8:2):5},selected.constellation);experiment=transitionExperimentV2(transitionExperimentV2(experiment,'started'),'completed');a.status='completed';a.attemptId=experiment.id;a.reservedAt=experiment.createdAt;a.resolvedAt=experiment.endedAt;a.result={schemaVersion:1,planId:p.id,candidateId:selected.id,assignmentIndex:a.index,context:fixtureContext,experiment:{...experiment,postState:{energy:1+a.index%2}}};}
  p.status='completed';return p;
}
test('Matched seed structural groups retain confounders, exact profiles and observation provenance',async()=>{
  const p=await structuralPlan(),r=await personalize([p],p.id,fixtureContext);
  for(const key of STRUCTURAL_GROUPS){const report=await analyzeStructure(r,key);assert.equal(report.groups.reduce((s,g)=>s+g.comparableN,0),20);assert.deepEqual(report.evidence,r);assert.ok(report.groups.every(g=>g.stratum.seedFrequencyHz===432&&g.stratum.durationSeconds===300&&g.expectation.mean===5));}
  const report=await analyzeStructure(r,'memberCount');assert.deepEqual(report.groups.map(g=>g.value),[1,2]);assert.deepEqual(report.groups.map(g=>g.change.mean),[1,2]);assert.ok(report.groups.every(g=>g.associationAvailable));
  const confounded=await structuralPlan(true),blocked=await analyzeStructure(await personalize([confounded],confounded.id,fixtureContext),'hciBand');assert.ok(blocked.groups.every(g=>g.expectationConfound&&!g.associationAvailable));
});
