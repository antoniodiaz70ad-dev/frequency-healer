import assert from 'node:assert/strict';
import test from 'node:test';
import { PROTOCOLS, getProtocolById } from '../src/lib/protocols';
import { buildProposal } from '../src/lib/voice/rules';
import type { ParsedIntentionV1, VoiceGoal } from '../src/lib/voice/types';
import { EVIDENCE_CATEGORIES, LEGACY_PROTOCOL_DISPOSITIONS_V1, PROTOCOL_LIBRARY_V1, SEED_SELECTION_BASES, protocolForRuleId } from '../src/lib/protocolLibrary';

const goals: VoiceGoal[] = ['clarity', 'focus', 'relaxation', 'reflection', 'creative_exploration', 'sleep_preparation', 'custom'];
const intensities = ['gentle', 'deep', 'experimental'] as const;
const intent = (goal: VoiceGoal, intensity: typeof intensities[number]): ParsedIntentionV1 => ({
  schemaVersion: 1, intention: goal, goal, desiredStates: [], durationMinutes: 5, intensity,
  sessionKind: 'exploratory', language: 'es-MX', confidence: { goal: 1, durationMinutes: 1, intensity: 1 }, requiresReview: goal === 'custom' ? ['goal'] : [],
});

test('canonical library has unique IDs, valid taxonomy and documented seed/evidence bases', () => {
  assert.equal(new Set(PROTOCOL_LIBRARY_V1.map(protocol => protocol.id)).size, PROTOCOL_LIBRARY_V1.length);
  for (const protocol of PROTOCOL_LIBRARY_V1) {
    assert.equal(protocol.schemaVersion, 1);
    assert.ok(protocol.candidateRuleIds.length > 0);
    assert.ok(protocol.seedSelectionBasis.length > 0);
    assert.ok(protocol.evidenceBasis.length > 0);
    assert.ok(protocol.seedSelectionBasis.every(value => SEED_SELECTION_BASES.includes(value)));
    assert.ok(protocol.evidenceBasis.every(value => EVIDENCE_CATEGORIES.includes(value)));
    assert.ok(protocol.status !== 'exploratory' || protocol.evidenceBasis.includes('EXPLORATORY'));
  }
});

test('every current voice rule resolves to one canonical protocol without changing proposals', () => {
  for (const goal of goals) for (const intensity of intensities) {
    const before = buildProposal(intent(goal, intensity));
    const protocol = protocolForRuleId(before.ruleId);
    assert.ok(protocol, before.ruleId);
    assert.equal(protocol.candidateRuleIds.filter(id => id === before.ruleId).length, 1);
    assert.deepEqual(buildProposal(intent(goal, intensity)), before);
  }
});

test('active protocols only reference executable current rule IDs and exploratory rules stay labeled', () => {
  const valid = new Set(goals.flatMap(goal => intensities.map(intensity => buildProposal(intent(goal, intensity)).ruleId)));
  for (const protocol of PROTOCOL_LIBRARY_V1.filter(protocol => protocol.status === 'active')) {
    assert.ok(protocol.candidateRuleIds.every(id => valid.has(id)));
    assert.ok(!protocol.intentCategories.includes('creative-exploration'));
    assert.ok(!protocol.intentCategories.includes('custom'));
  }
  assert.equal(PROTOCOL_LIBRARY_V1.some(protocol => protocol.status === 'deprecated'), false);
  assert.equal(PROTOCOL_LIBRARY_V1.find(protocol => protocol.id === 'guided-creative-exploration')?.status, 'exploratory');
  assert.equal(PROTOCOL_LIBRARY_V1.find(protocol => protocol.id === 'guided-custom-review')?.status, 'exploratory');
});

test('legacy protocol IDs remain readable and are not duplicated by the canonical guided registry', () => {
  assert.equal(new Set(PROTOCOLS.map(protocol => protocol.id)).size, PROTOCOLS.length);
  for (const protocol of PROTOCOLS) assert.deepEqual(getProtocolById(protocol.id), protocol);
  assert.ok(PROTOCOLS.every(legacy => !PROTOCOL_LIBRARY_V1.some(current => current.id === legacy.id)));
  assert.deepEqual(new Set(LEGACY_PROTOCOL_DISPOSITIONS_V1.map(value => value.protocolId)), new Set(PROTOCOLS.map(value => value.id)));
  assert.ok(LEGACY_PROTOCOL_DISPOSITIONS_V1.every(value => value.status === 'exploratory' || value.action === 'exclude-from-new-recommendations'));
  assert.ok(LEGACY_PROTOCOL_DISPOSITIONS_V1.filter(value => value.status === 'deprecated').every(value => !PROTOCOL_LIBRARY_V1.some(protocol => protocol.id === value.protocolId)));
});
