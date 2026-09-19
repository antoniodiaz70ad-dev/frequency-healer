import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { frequency, RATIOS } from '../src/lib/harmonic/math';
import { ratioFrequency, canonicalRatio } from '../src/lib/harmonic/ratios';
import { octaveFrequency } from '../src/lib/harmonic/octaves';
import { compileConstellation, validateConstellation, CONSTELLATION_GENERATION_VERSION, type ConstellationInputV1 } from '../src/lib/harmonic/constellations';

function example(mode: 'sequence' | 'simultaneous' = 'sequence'): ConstellationInputV1 {
  return { seedFrequencyHz: 432, playbackMode: mode, members: [
    { id: 'root', relationshipType: 'root' },
    { id: 'third', relationshipType: 'ratio', ratio: { numerator: 5, denominator: 4 } },
    { id: 'fifth', relationshipType: 'ratio', ratio: { numerator: 3, denominator: 2 } },
    { id: 'octave', relationshipType: 'octave', octaveOffset: 1 },
  ] };
}

test('octaves: exact 432 Hz examples, integer offsets and authoritative bounds without folding', () => {
  assert.deepEqual([-3, -2, -1, 0, 1, 2].map(offset => octaveFrequency(432, offset)), [54, 108, 216, 432, 864, 1728]);
  assert.equal(octaveFrequency(40, 0), 40); assert.equal(octaveFrequency(2000, 0), 2000);
  assert.equal(octaveFrequency(432.123456789, 1), 432.123456789 * 2);
  for (const offset of [0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, -4, 3, 1024, -1075]) assert.throws(() => octaveFrequency(432, offset));
  for (const seed of [0, 39, 2001, NaN, Infinity]) assert.throws(() => octaveFrequency(seed, 0));
});

test('ratios: exact examples and unchanged named V1 frequencies across seeds', () => {
  assert.deepEqual([[1, 1], [5, 4], [4, 3], [3, 2], [5, 3], [2, 1]].map(([numerator, denominator]) => ratioFrequency(432, { numerator, denominator })), [432, 540, 576, 648, 720, 864]);
  for (const seed of [40, 220, 432, 432.123456789]) for (const ratio of Object.values(RATIOS)) {
    assert.equal(ratioFrequency(seed, { numerator: ratio.p, denominator: ratio.q }), frequency(seed, ratio.p, ratio.q));
  }
  for (const [numerator, denominator] of [[1, 0], [-1, 1], [1, -1], [0, 1], [NaN, 1], [1, NaN], [Infinity, 1], [1, Infinity]]) assert.throws(() => ratioFrequency(432, { numerator, denominator }));
  assert.throws(() => ratioFrequency(432, { numerator: 5, denominator: 1 }));
  assert.throws(() => ratioFrequency(40, { numerator: 1, denominator: 2 }));
  assert.throws(() => ratioFrequency(2001, { numerator: 1, denominator: 2 }));
  assert.equal(ratioFrequency(432, { numerator: 1e308, denominator: 1e308 }), 432);
  assert.equal(ratioFrequency(432, { numerator: Number.MIN_VALUE, denominator: Number.MIN_VALUE }), 432);
});

test('ratio canonicalization: exact equivalence, without approximating decimals to familiar ratios', () => {
  assert.deepEqual(canonicalRatio({ numerator: 6, denominator: 4 }), ['3', '2']);
  assert.deepEqual(canonicalRatio({ numerator: 1.5, denominator: 1 }), ['3', '2']);
  assert.deepEqual(canonicalRatio({ numerator: 0.1, denominator: 0.2 }), ['1', '2']);
  assert.notDeepEqual(canonicalRatio({ numerator: 0.3, denominator: 0.2 }), ['3', '2']);
  assert.notDeepEqual(canonicalRatio({ numerator: 1.3333333333333333, denominator: 1 }), ['4', '3']);
  assert.deepEqual(canonicalRatio({ numerator: Number.MIN_VALUE, denominator: Number.MIN_VALUE }), ['1', '1']);
  assert.equal(ratioFrequency(432, { numerator: 0.3, denominator: 0.2 }), frequency(432, 0.3, 0.2));
});

test('compiler: reproducible frozen data only, with explicit ordered member IDs', async () => {
  const input = example();
  const pending = compileConstellation(input);
  input.members.reverse(); // A caller mutation during hashing cannot change the snapshot.
  const result = await pending;
  assert.deepEqual(result.members.map(member => member.frequencyHz), [432, 540, 648, 864]);
  assert.deepEqual(result.playbackOrder, ['root', 'third', 'fifth', 'octave']);
  assert.equal(result.schemaVersion, 1); assert.equal(result.generationVersion, CONSTELLATION_GENERATION_VERSION);
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.members)); assert.ok(Object.isFrozen(result.members[1]));
  assert.ok(Object.isFrozen(result.playbackOrder));
  assert.deepEqual(result, await compileConstellation(example()));
  assert.deepEqual(await validateConstellation(JSON.parse(JSON.stringify(result))), result);
});

test('signature: names, ratio labels and user IDs are not mathematical identity', async () => {
  const a = example(); const b = example(); b.id = 'different-document'; b.name = 'Another display name';
  b.members = b.members.map((member, i) => member.relationshipType === 'ratio'
    ? { ...member, id: `renamed-${i}`, ratio: { ...member.ratio, label: 'Display only' } }
    : { ...member, id: `renamed-${i}` });
  const first = await compileConstellation(a), second = await compileConstellation(b);
  assert.equal(first.signature, second.signature); assert.notEqual(first.id, second.id);
});

test('signature: equivalent ratio fractions and root/octave/ratio representations share identity', async () => {
  const a = example(); const b = example();
  b.members = [
    { id: 'a', relationshipType: 'ratio', ratio: { numerator: 1, denominator: 1 } },
    { id: 'b', relationshipType: 'ratio', ratio: { numerator: 10, denominator: 8 } },
    { id: 'c', relationshipType: 'ratio', ratio: { numerator: 6, denominator: 4 } },
    { id: 'd', relationshipType: 'ratio', ratio: { numerator: 2, denominator: 1 } },
  ];
  assert.equal((await compileConstellation(a)).signature, (await compileConstellation(b)).signature);
  b.members[0] = { id: 'a', relationshipType: 'octave', octaveOffset: 0 };
  assert.equal((await compileConstellation(a)).signature, (await compileConstellation(b)).signature);
});

test('signature: seed, ratio, octave, mode and sequential order affect identity', async () => {
  const base = (await compileConstellation(example())).signature;
  const seed = example(); seed.seedFrequencyHz = 440;
  const ratio = example(); ratio.members[1] = { id: 'third', relationshipType: 'ratio', ratio: { numerator: 4, denominator: 3 } };
  const octave = example(); octave.members[3] = { id: 'octave', relationshipType: 'octave', octaveOffset: -1 };
  const order = example(); order.members.reverse();
  for (const change of [seed, ratio, octave, order, example('simultaneous')]) assert.notEqual((await compileConstellation(change)).signature, base);
  const simultaneous = example('simultaneous'), reordered = example('simultaneous'); reordered.members.reverse();
  assert.equal((await compileConstellation(simultaneous)).signature, (await compileConstellation(reordered)).signature);
  assert.equal((await compileConstellation(simultaneous)).playbackOrder, null);
});

test('signature: conventional SHA-256 of documented canonical tuple', async () => {
  const result = await compileConstellation({ seedFrequencyHz: 432, playbackMode: 'sequence', members: [{ id: 'root', relationshipType: 'root' }] });
  const canonical = JSON.stringify(['harmonic-constellation', 1, CONSTELLATION_GENERATION_VERSION, 432, 'sequence', [['octave', 0]], [['octave', 0]]]);
  assert.equal(result.signature, `sha256:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`);
});

test('duplicates: IDs must be unique, mathematical repetitions are retained and affect signature', async () => {
  const single: ConstellationInputV1 = { seedFrequencyHz: 432, playbackMode: 'simultaneous', members: [{ id: 'one', relationshipType: 'root' }] };
  await assert.rejects(compileConstellation({ ...single, members: [single.members[0], single.members[0]] }), /ID/);
  const duplicate = await compileConstellation({ ...single, members: [...single.members, { id: 'two', relationshipType: 'root' }] });
  assert.deepEqual(duplicate.members.map(member => member.frequencyHz), [432, 432]);
  assert.notEqual(duplicate.signature, (await compileConstellation(single)).signature);
});

test('compiler runtime rejects malformed, ambiguous and out-of-range inputs without coercion', async () => {
  for (const patch of [
    { seedFrequencyHz: 39 }, { seedFrequencyHz: 2001 }, { seedFrequencyHz: NaN }, { seedFrequencyHz: Infinity }, { seedFrequencyHz: '432' },
    { playbackMode: 'random' }, { members: [] }, { members: new Array(2) }, { members: null }, { unexpected: true },
    { members: [{ id: 'x', relationshipType: 'root', ratio: { numerator: 1, denominator: 1 } }] },
    { members: [{ id: 'x', relationshipType: 'root', frequencyHz: 432 }] },
    { members: [{ id: 'x', relationshipType: 'ratio', ratio: { numerator: 1, denominator: 0 } }] },
    { members: [{ id: 'x', relationshipType: 'ratio', ratio: { numerator: 1, denominator: 1 }, octaveOffset: 1 }] },
    { members: [{ id: 'x', relationshipType: 'octave', octaveOffset: 0.5 }] },
    { members: [{ id: 'x', relationshipType: 'octave', octaveOffset: 3 }] },
    { members: [{ id: 'x', relationshipType: 'ratio', ratio: { numerator: 5, denominator: 1 } }] },
    { members: [{ id: '', relationshipType: 'root' }] },
    { name: 'x'.repeat(201) },
  ]) await assert.rejects(compileConstellation({ ...example(), ...patch } as unknown as ConstellationInputV1));
  const many = Array.from({ length: 10 }, (_, i) => ({ id: `${i}`, relationshipType: 'root' as const }));
  await assert.rejects(compileConstellation({ ...example('simultaneous'), members: many }));
  assert.equal((await compileConstellation({ ...example(), members: many })).members.length, 10);
});

test('snapshot validation recomputes frequencies/signature/order; unknown generation cannot be reinterpreted', async () => {
  const result = await compileConstellation(example());
  for (const patch of [
    { schemaVersion: 2 }, { generationVersion: 'future-version' }, { signature: 'sha256:wrong' },
    { playbackOrder: [...result.playbackOrder!].reverse() }, { intention: 'not part of this contract' },
    { members: result.members.map((member, i) => i === 0 ? { ...member, frequencyHz: 433 } : member) },
  ]) await assert.rejects(validateConstellation({ ...result, ...patch }));
  const mutable = JSON.parse(JSON.stringify(result)); mutable.members[0].frequencyHz = 433;
  const validation = validateConstellation(mutable);
  mutable.members[0].frequencyHz = 432; // Cannot repair the input after validation has begun.
  await assert.rejects(validation);
});
