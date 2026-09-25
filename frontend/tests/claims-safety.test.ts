import assert from 'node:assert/strict';
import test from 'node:test';
import { FREQUENCY_DATABASE, getFrequencyById } from '../src/lib/frequencies';
import { PROTOCOLS, getProtocolById } from '../src/lib/protocols';
import { buildProposal } from '../src/lib/voice/rules';
import { parseLocalIntent } from '../src/lib/voice/intentParser';
import { LEGACY_PROTOCOL_DISPOSITIONS_V1, PROTOCOL_LIBRARY_V1, frequencyClaimClassification, protocolForRuleId } from '../src/lib/protocolLibrary';

const frequencyIdentity = [
  ['bw-epsilon',0.5],['bw-delta-low',1],['bw-delta',2],['bw-theta-low',4],['bw-theta',6],['bw-schumann',7.83],['bw-alpha-low',8],['bw-alpha',10],['bw-alpha-iq-11',11],['bw-alpha-high',12],['bw-alpha-peak',13],['bw-nfb-reward',600],['bw-beta',20],['bw-gamma',40],['bw-gamma-high',100],
  ['sol-174',174],['sol-285',285],['sol-396',396],['sol-417',417],['sol-528',528],['sol-639',639],['sol-741',741],['sol-852',852],['sol-963',963],['mus-432',432],
  ['rife-72',72],['rife-306',306],['rife-727',727],['rife-787',787],['rife-880',880],['rife-1150',1150],['rife-1550',1550],['rife-2112',2112],['rife-993',993.98],['rife-5000',5000],['rife-10000',10000],['rife-20000',20000],['nog-292',292],['nog-584',584],['nog-1168',1168],
] as const;

test('all 41 historical frequency IDs and numeric values remain unchanged and classified', () => {
  assert.deepEqual(FREQUENCY_DATABASE.map(value => [value.id, value.hz]), frequencyIdentity);
  for (const [id] of frequencyIdentity) {
    const entry = getFrequencyById(id); assert.ok(entry);
    assert.notEqual(frequencyClaimClassification(entry.category), 'PUBLISHED_EVIDENCE');
    assert.notEqual(entry.evidence, 'verificada');
  }
});

test('all 15 historical protocols remain addressable with exact playback configurations and dispositions', () => {
  const identity = PROTOCOLS.map(protocol => ({ id: protocol.id, minutes: protocol.totalDurationMinutes, steps: protocol.steps.map(step => [step.frequencyHz, step.waveform, step.durationSeconds, step.volume, step.binaural?.differenceHz ?? null]) }));
  assert.deepEqual(identity.map(value => value.id), LEGACY_PROTOCOL_DISPOSITIONS_V1.map(value => value.protocolId));
  assert.equal(identity.length, 15);
  for (const protocol of PROTOCOLS) assert.deepEqual(getProtocolById(protocol.id), protocol);
  assert.deepEqual(identity.find(value => value.id === 'frecuencia-milagro')?.steps, [[528, 'sine', 1200, 0.45, null]]);
  assert.deepEqual(identity.find(value => value.id === 'antiparasitario')?.steps, [[993.98, 'square', 300, 0.4, null], [1150, 'square', 300, 0.4, null], [2112, 'square', 300, 0.4, null]]);
});

test('deprecated legacy entries cannot resolve as core guided recommendations', () => {
  for (const value of LEGACY_PROTOCOL_DISPOSITIONS_V1.filter(value => value.status === 'deprecated')) {
    assert.equal(PROTOCOL_LIBRARY_V1.some(protocol => protocol.id === value.protocolId), false);
  }
  const proposal = buildProposal(parseLocalIntent('Quiero calma 5 minutos'));
  assert.equal(proposal.ruleId, 'voice-relaxation-gentle');
  assert.equal(protocolForRuleId(proposal.ruleId)?.id, 'guided-calm');
  assert.ok(proposal.rationale.every(value => !/ADN|antiviral|Alzheimer|chakra|pineal|IQ|parásit/i.test(value)));
});

