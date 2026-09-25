import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileConstellation } from '../src/lib/harmonic/constellations';
import { planConstellationPlayback } from '../src/lib/harmonic/constellationPlayback';
import { buildSchedule, masterGain, voiceGain, type HarmonicConfig } from '../src/lib/harmonic/math';
import { prepareExperiment, validateExperiment } from '../src/lib/experiments/validation';
const context: HarmonicConfig = {baseHz:220,ratioId:'cascade-13-12',increments:3,direction:'return',mode:'sequence',durationSeconds:60,uiVolume:20,waveform:'sine'};
const members = [{id:'fifth',relationshipType:'ratio' as const,ratio:{numerator:3,denominator:2}},{id:'root1',relationshipType:'root' as const},{id:'root2',relationshipType:'root' as const}];
for(const playbackMode of ['sequence','simultaneous'] as const)test(`constellation playback ${playbackMode}: exact order/multiplicity and immutable V1 snapshot`,async()=>{
  const record=await compileConstellation({id:'saved',name:'Original',seedFrequencyHz:432,members,playbackMode});const before=JSON.stringify(record),source=JSON.stringify(context);
  const plan=await planConstellationPlayback(record,context);
  assert.deepEqual(plan.config.progression,['fifth','root','root']);assert.equal(plan.config.baseHz,432);assert.equal(plan.config.mode,playbackMode);
  assert.deepEqual(plan.schedule.steps.flatMap(s=>s.frequencies),[648,432,432]);assert.deepEqual(buildSchedule(plan.config),plan.schedule);
  assert.equal(plan.schedule.steps.length,playbackMode==='sequence'?3:1);
  assert.deepEqual(plan.schedule.steps.map(s=>s.offsetSeconds),playbackMode==='sequence'?[0,20,40]:[0]);
  assert.equal(masterGain(plan.config.uiVolume),0.05);assert.equal(voiceGain(plan.schedule.steps[0].frequencies.length),playbackMode==='sequence'?1:1/3);
  const experiment=prepareExperiment(plan.config,{preState:{clarity:0}});assert.deepEqual(validateExperiment(experiment).configurationSnapshot,plan.config);
  assert.equal(JSON.stringify(record),before);assert.equal(JSON.stringify(context),source);assert.ok(Object.isFrozen(plan.config.progression));
});
test('constellation playback: all exact V1 ratios accepted; nine voices preserved',async()=>{
  const definitions=[[1,1],[3,2],[4,3],[5,4],[6,5],[1,1],[1,1],[3,2],[3,2]].map(([numerator,denominator],i)=>({id:String(i),relationshipType:'ratio' as const,ratio:{numerator,denominator}}));
  const record=await compileConstellation({seedFrequencyHz:432,members:definitions,playbackMode:'simultaneous'});
  const plan=await planConstellationPlayback(record,context);assert.equal(plan.schedule.steps[0].frequencies.length,9);assert.equal(voiceGain(9),1/9);assert.deepEqual(plan.schedule.steps[0].frequencies,record.members.map(m=>m.frequencyHz));
});
test('constellation playback: no approximations, drops, malformed input or unsafe timing',async()=>{
  for(const member of [{id:'o',relationshipType:'octave' as const,octaveOffset:0},{id:'o',relationshipType:'octave' as const,octaveOffset:1},...[{numerator:5,denominator:3},{numerator:2,denominator:1},{numerator:6,denominator:4}].map(ratio=>({id:'r',relationshipType:'ratio' as const,ratio}))]){
    const record=await compileConstellation({seedFrequencyHz:432,playbackMode:'sequence',members:[...members,member]});await assert.rejects(planConstellationPlayback(record,context),/no representable/);
  }
  const many=await compileConstellation({seedFrequencyHz:432,playbackMode:'sequence',members:Array.from({length:10},(_,i)=>({id:String(i),relationshipType:'root' as const}))});await assert.rejects(planConstellationPlayback(many,context),/máximo 9/);
  const record=await compileConstellation({seedFrequencyHz:432,playbackMode:'sequence',members});
  for(const patch of [{durationSeconds:0},{durationSeconds:Infinity},{uiVolume:101},{waveform:'square'}])await assert.rejects(planConstellationPlayback(record,{...context,...patch} as HarmonicConfig));
  await assert.rejects(planConstellationPlayback({...record,signature:'invalid'},context));
  await assert.rejects(planConstellationPlayback({...record,members:record.members.map(m=>({...m,frequencyHz:1}))},context));
});
