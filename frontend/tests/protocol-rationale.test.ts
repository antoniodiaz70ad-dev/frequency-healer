import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretGuidedIntent, recommendGuided, validateGuidedRecommendation } from '../src/lib/guided/recommendations';
import { protocolRationale, EVIDENCE_LABELS } from '../src/lib/guided/rationale';
import { buildProposal } from '../src/lib/voice/rules';
import { parseLocalIntent } from '../src/lib/voice/intentParser';
import { prepareExperimentV2, validateExperimentV2 } from '../src/lib/experiments/v2';
import { compileConstellation } from '../src/lib/harmonic/constellations';
import { planConstellationPlayback } from '../src/lib/harmonic/constellationPlayback';

for (const [words, goal] of [['Quiero calma','relaxation'],['Necesito concentrarme','focus'],['Quiero dormir','sleep_preparation'],['Necesito recuperarme','relaxation'],['Quiero sentirme centrado','relaxation'],['Quiero creatividad','creative_exploration'],['Quiero meditar','reflection'],['Quiero evitar drenaje energético','relaxation']]) {
  test(`2B explanation comes from exact existing rule: ${words}`, () => {
    const recommendation = recommendGuided(interpretGuidedIntent(words));
    const { proposal, rule } = recommendation;
    assert.equal(proposal.intent.goal,goal);
    assert.deepEqual(proposal, buildProposal(proposal.intent));
    assert.equal(rule.id,proposal.ruleId); assert.equal(rule.generationVersion,proposal.ruleVersion);
    assert.deepEqual(validateGuidedRecommendation(recommendation,true),proposal.harmonicConfig);
    const components=rule.rationale.components;
    assert.deepEqual(components.filter(c=>c.componentType==='ratio').map(c=>c.value),proposal.schedule.steps.flatMap(s=>s.frequencies.map((hz,i)=>`${s.ratios[i]} → ${hz} Hz`)));
    for(const type of ['seed','mode','duration','volume'])assert.ok(components.some(c=>c.componentType===type));
    assert.ok(components.every(c=>c.role&&c.explanation&&Object.hasOwn(EVIDENCE_LABELS,c.basis)));
    assert.equal(components.some(c=>c.componentType==='octave'),false);
    assert.equal(recommendation.personalEvidence.comparableSessions,0);
  });
}
test('2B exact custom Voice rationale preserves config and multiplicity, with no invented scientific attribution',()=>{
  const proposal=buildProposal(parseLocalIntent('Quiero enfoque profundo 20 minutos'),{baseHz:220,mode:'simultaneous',uiVolume:0});
  const bytes=JSON.stringify(proposal),rationale=protocolRationale(proposal);
  assert.equal(JSON.stringify(proposal),bytes);
  assert.equal(rationale.components.filter(c=>c.componentType==='ratio').length,4);
  assert.match(rationale.components[0].explanation,/elegida por ti/);
  assert.equal(rationale.components.find(c=>c.componentType==='volume')!.value,'0/100');
  assert.equal(rationale.components.some(c=>c.basis==='traditional'||c.basis==='personal-n1'),false);
});
test('2B explanation/rule/schedule tampering rejected before confirmation',()=>{
  const value=recommendGuided(interpretGuidedIntent('Quiero calma'));
  for(const mutate of [(v:typeof value)=>{v.rule.id='invented';},(v:typeof value)=>{v.rule.rationale.purpose='Guaranteed cure';},(v:typeof value)=>{v.proposal.schedule.steps[0].frequencies[0]=999;}]){const copy=structuredClone(value);mutate(copy);assert.throws(()=>validateGuidedRecommendation(copy,true));}
});
test('2B V2 saved constellation path remains independently auditable; legacy guide never fabricates a link',async()=>{
  const guide=recommendGuided(interpretGuidedIntent('Quiero enfoque'));
  assert.equal(guide.rule.candidateType,'legacy-harmonic-config');assert.equal('constellation' in guide,false);
  const constellation=await compileConstellation({id:'2b-saved',seedFrequencyHz:432,playbackMode:'sequence',members:[{id:'root',relationshipType:'root'},{id:'fifth',relationshipType:'ratio',ratio:{numerator:3,denominator:2}}]});
  const plan=await planConstellationPlayback(constellation,guide.proposal.harmonicConfig);
  const record=await prepareExperimentV2(plan.config,{preState:{}},constellation);
  assert.deepEqual((await validateExperimentV2(record)).constellation!.snapshot,constellation);
});
