import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSchedule, type HarmonicConfig } from '../src/lib/harmonic/math';
import { buildLegacyProposal, buildProposal, validateProposal } from '../src/lib/voice/rules';
import { SEED_REGISTRY_V1, SEED_REGISTRY_VERSION, SEED_SELECTION_VERSION, STRUCTURAL_TIER_TOLERANCE_OCTAVES, evidenceFingerprint, selectSeed, type SeedEvidenceV1 } from '../src/lib/voice/seedSelection';
import type { ParsedIntentionV1 } from '../src/lib/voice/types';

const intent=(goal:ParsedIntentionV1['goal'],intensity:ParsedIntentionV1['intensity']):ParsedIntentionV1=>({schemaVersion:1,intention:goal,goal,desiredStates:[],durationMinutes:15,intensity,sessionKind:'exploratory',language:'es-MX',confidence:{goal:1,durationMinutes:1,intensity:1},requiresReview:[]});

test('registry V1 is exact, independent and every seed supports all current goal/intensity schedules',()=>{
  assert.deepEqual(SEED_REGISTRY_V1,[80,112,144,192,224,256,320,448,640]);assert.equal(SEED_REGISTRY_VERSION,'seed-registry-v1');assert.equal(SEED_SELECTION_VERSION,'seed-selection-v1');
  for(const goal of ['clarity','focus','relaxation','reflection','creative_exploration','sleep_preparation','custom'] as const)for(const intensity of ['gentle','deep','experimental'] as const){
    const proposal=buildProposal(intent(goal,intensity));const again=buildProposal(intent(goal,intensity));assert.deepEqual(proposal,again);assert.deepEqual(proposal.schedule,buildSchedule(proposal.harmonicConfig));
    assert.ok(proposal.schedule.steps.flatMap(s=>s.frequencies).every(hz=>hz>=40&&hz<=2000));assert.equal(proposal.seedSelection!.candidates.length,9);assert.ok(proposal.seedSelection!.candidates.every(c=>c.valid));
  }
});

test('all guided goal/intensity selections are pinned and progression-specific',()=>{
  const expected={clarity:[256,224,256],focus:[256,224,256],relaxation:[256,256,256],reflection:[256,256,256],creative_exploration:[256,256,256],sleep_preparation:[256,256,256],custom:[224,224,256]} as const;
  for(const goal of Object.keys(expected) as Array<keyof typeof expected>)['gentle','deep','experimental'].forEach((intensity,index)=>assert.equal(buildProposal(intent(goal,intensity as ParsedIntentionV1['intensity'])).harmonicConfig.baseHz,expected[goal][index],`${goal}/${intensity}`));
});

test('0.10-octave structural tier gates evidence; preliminary displays only and descriptive can reorder within tier',()=>{
  const config=buildProposal(intent('relaxation','deep')).harmonicConfig,effective=config.progression!;
  const preliminary:SeedEvidenceV1={source:'personal-n1',comparableN:9,evidenceLevel:'preliminary',signal:10};
  const descriptive:SeedEvidenceV1={source:'personal-n1',comparableN:10,evidenceLevel:'descriptive',signal:10};
  const descriptiveBaseline:SeedEvidenceV1={source:'personal-n1',comparableN:10,evidenceLevel:'descriptive',signal:0};
  assert.equal(STRUCTURAL_TIER_TOLERANCE_OCTAVES,0.10);
  assert.equal(selectSeed(config,effective,{personal:{224:preliminary}}).selectedSeedHz,256);
  assert.equal(selectSeed(config,effective,{personal:{224:descriptive,256:descriptiveBaseline}}).selectedSeedHz,224);
  assert.equal(selectSeed(config,effective,{personal:{192:descriptive}}).selectedSeedHz,256,'evidence cannot escape structural tier');
  const discovery:SeedEvidenceV1={source:'discovery',comparableN:10,evidenceLevel:'descriptive',signal:9};
  assert.equal(selectSeed(config,effective,{personal:{224:descriptiveBaseline,256:descriptiveBaseline},discovery:{224:discovery,256:{...discovery,signal:0}}}).selectedSeedHz,224);
});

test('full schedule gates custom lower/upper/cascade failures without clamp and preserves simultaneous limits',()=>{
  const base:HarmonicConfig={baseHz:144,ratioId:'fifth',increments:3,direction:'return',mode:'sequence',durationSeconds:900,uiVolume:20,waveform:'sine',progression:['root','fifth']};
  assert.throws(()=>selectSeed(base,['root','fifth'],{},39));assert.throws(()=>selectSeed(base,['root','fifth'],{},1900));
  const cascade={...base,ratioId:'cascade-13-12' as const,increments:8,direction:'ascending' as const,progression:undefined};assert.throws(()=>selectSeed(cascade,['cascade'],{},1900));
  const simultaneous={...base,mode:'simultaneous' as const,progression:Array(9).fill('root') as HarmonicConfig['progression']};assert.equal(selectSeed(simultaneous,simultaneous.progression!).selectedSeedHz,256);
});

test('V2 identity includes policy versions even for same seed; tampering rejected; V1 remains readable',()=>{
  const p=buildProposal(intent('focus','deep'),{}, {fingerprint:evidenceFingerprint('voice','discovery')});const id=p.proposalIdentity!;
  assert.deepEqual([id.ruleVersion,id.seedRegistryVersion,id.seedSelectionVersion,id.intent,id.effectiveProgression,id.selectedSeed,id.finalHarmonicConfig],['voice-rules-v2','seed-registry-v1','seed-selection-v1',p.intent,p.seedSelection!.effectiveProgression,p.harmonicConfig.baseHz,p.harmonicConfig]);
  const changed=structuredClone(p);changed.proposalIdentity!.selectedSeed+=1;assert.throws(()=>validateProposal(changed));
  const legacy=buildLegacyProposal(intent('focus','deep'));assert.equal(legacy.harmonicConfig.baseHz,144);assert.equal(legacy.seedSelection,undefined);assert.equal(validateProposal(legacy).ruleVersion,'voice-rules-v1');
});

test('historical folklore values never enter the registry or ranking inputs',()=>{
  for(const value of [432,528,963])assert.equal(SEED_REGISTRY_V1.includes(value as never),false);
  const p=buildProposal(intent('relaxation','deep'));assert.equal(JSON.stringify(p.seedSelection).match(/DNA|pineal|healing|chakra/gi),null);
});
