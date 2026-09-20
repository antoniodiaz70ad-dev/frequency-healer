import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretGuidedIntent, recommendGuided, validateGuidedRecommendation, personalEvidence } from '../src/lib/guided/recommendations';
import { buildProposal } from '../src/lib/voice/rules';
import { buildSchedule } from '../src/lib/harmonic/math';
import type { VoiceSessionRecordV1 } from '../src/lib/voice/types';
const cases=[['Quiero calma','relaxation'],['Necesito concentrarme','focus'],['Quiero dormir mejor','sleep_preparation'],['Quiero recuperarme después de una reunión','relaxation'],['Quiero sentirme más centrado','relaxation'],['Quiero creatividad','creative_exploration'],['Quiero meditar','reflection'],['quiero evitar drenaje energético','relaxation'],['Me siento disperso','focus'],['Estoy muy tenso','relaxation']] as const;
for(const [raw,goal] of cases)test(`guided intent: ${raw}`,()=>{
  const interpretation=interpretGuidedIntent(raw);assert.equal(interpretation.intent.goal,goal);
  const a=recommendGuided(interpretation),b=recommendGuided(interpretation);assert.deepEqual(a,b);assert.equal(a.proposal.ruleId,`voice-${goal}-gentle`);assert.equal(a.proposal.ruleVersion,'voice-rules-v1');
  assert.deepEqual(a.proposal,buildProposal(interpretation.intent));assert.deepEqual(a.proposal.schedule,buildSchedule(a.proposal.harmonicConfig));assert.ok(a.explanation.length);assert.equal(a.interpretation.rawText,raw);assert.equal(a.personalEvidence.comparableSessions,0);assert.equal(a.personalEvidence.evidenceLevel,'none');
  assert.deepEqual(validateGuidedRecommendation(a,true),a.proposal.harmonicConfig);
});
const interpretation=interpretGuidedIntent('Quiero calma 5 minutos'),proposal=recommendGuided(interpretation).proposal;
function record(i:number):VoiceSessionRecordV1{return {schemaVersion:1,id:`evidence-${i}`,createdAt:'2026-09-01T12:00:00.000Z',completedAt:'2026-09-01T12:05:00.000Z',status:'completed',intent:proposal.intent,proposal,markers:[],before:{clarity:0,stress:5,focus:2},after:{clarity:1,stress:3,focus:3},technical:{actualDurationMs:300000,stopReason:'completed'}};}
for(const [n,level] of [[0,'none'],[4,'insufficient'],[5,'preliminary'],[9,'preliminary'],[10,'descriptive'],[12,'descriptive']] as const)test(`guided evidence N=${n}`,()=>{
  const rows=Array.from({length:n},(_,i)=>record(i));const r=recommendGuided(interpretation,rows);assert.equal(r.personalEvidence.comparableSessions,n);assert.equal(r.personalEvidence.evidenceLevel,level);assert.equal(r.personalEvidence.metrics.length,n<5?0:3);assert.deepEqual(r.proposal,proposal);
  if(n>=5){assert.equal(r.personalEvidence.metrics[0].mean,1);assert.equal(r.personalEvidence.metrics[0].n,n);}
});
test('guided comparability: exact config, complete outcomes, completion, commands and corruption',()=>{
  const rows=Array.from({length:5},(_,i)=>record(i));
  const mismatches:VoiceSessionRecordV1[]=[{...record(5),before:{focus:1}},{...record(6),status:'stopped'},{...record(7),technical:{actualDurationMs:1}},{...record(8),proposal:buildProposal(proposal.intent,{uiVolume:1})},{...record(9),markers:[{id:'m',offsetMs:0,wallClockCreatedAt:'2026-09-01T12:00:00.000Z',kind:'command',note:'baja el volumen',harmonicSnapshot:{stepIndex:0,baseHz:144,activeHz:[172.8],ratioId:'minor-third'}}]}];
  const before=JSON.stringify(mismatches);assert.equal(personalEvidence(proposal,[...rows,...mismatches]).comparableSessions,5);assert.equal(JSON.stringify(mismatches),before);
  assert.equal(personalEvidence(proposal,null).comparableSessions,null);assert.equal(personalEvidence(proposal,null).available,false);
  assert.throws(()=>personalEvidence(proposal,[{},...rows]));assert.throws(()=>personalEvidence(proposal,[record(0),record(0)]));
});
test('guided correction, boundaries and confirmation reject injected executable output',()=>{
  const original=interpretGuidedIntent('drenaje energético');assert.match(original.explanation,/No asumimos/);
  const corrected={...original,intent:{...original.intent,goal:'focus' as const,desiredStates:[]}};assert.equal(recommendGuided(corrected).proposal.ruleId,'voice-focus-gentle');
  assert.throws(()=>interpretGuidedIntent('Quiero curar dolor de pecho'));assert.throws(()=>interpretGuidedIntent('calma 999 minutos'));assert.throws(()=>interpretGuidedIntent(''));
  const creative=recommendGuided(interpretGuidedIntent('Quiero creatividad'));assert.throws(()=>validateGuidedRecommendation(creative,false),/consentimiento/);assert.ok(validateGuidedRecommendation(creative,true));
  const bad=structuredClone(recommendGuided(original));bad.proposal.harmonicConfig.baseHz=528;assert.throws(()=>validateGuidedRecommendation(bad,false));
  const badSchedule=structuredClone(recommendGuided(original));badSchedule.proposal.schedule.steps[0].frequencies[0]=999;assert.throws(()=>validateGuidedRecommendation(badSchedule,false));
});
