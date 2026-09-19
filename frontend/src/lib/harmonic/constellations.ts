import { frequency, voiceGain, type HarmonicConfig } from './math';
import { octaveFrequency } from './octaves';
import { canonicalRatio, ratioFrequency, validateRatio, type HarmonicRatioV1 } from './ratios';

/** Version of this data compiler, not a claim that a new playback engine exists. */
export const CONSTELLATION_GENERATION_VERSION = 'harmonic-constellation-v1' as const;
export type HarmonicRelationshipV1 =
  | { readonly id: string; readonly relationshipType: 'root' }
  | { readonly id: string; readonly relationshipType: 'ratio'; readonly ratio: HarmonicRatioV1 }
  | { readonly id: string; readonly relationshipType: 'octave'; readonly octaveOffset: number };
export type HarmonicMemberV1 = HarmonicRelationshipV1 & { readonly frequencyHz: number };
export interface ConstellationInputV1 {
  id?: string;
  name?: string;
  seedFrequencyHz: number;
  members: HarmonicRelationshipV1[];
  playbackMode: HarmonicConfig['mode'];
}
export interface HarmonicConstellationV1 {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly name?: string;
  readonly seedFrequencyHz: number;
  /** Original input/display order and operands retained for exact reconstruction. */
  readonly members: readonly HarmonicMemberV1[];
  readonly playbackMode: HarmonicConfig['mode'];
  /** Sequential member IDs in playback order; null for simultaneous semantics. */
  readonly playbackOrder: readonly string[] | null;
  readonly generationVersion: typeof CONSTELLATION_GENERATION_VERSION;
  readonly signature: string;
}

function object(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new Error('Constelación inválida: estructura desconocida.');
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number, nonempty = false): string {
  if (typeof value !== 'string' || value.length > max || (nonempty && !value.trim())) throw new Error('Nombre o ID de constelación inválido.');
  return value;
}
function member(value: unknown, seed: number): HarmonicMemberV1 {
  const v = object(value, ['id', 'relationshipType', 'ratio', 'octaveOffset']);
  const id = text(v.id, 100, true);
  switch (v.relationshipType) {
    case 'root':
      object(v, ['id', 'relationshipType']);
      return Object.freeze({ id, relationshipType: 'root', frequencyHz: frequency(seed, 1, 1) });
    case 'ratio': {
      object(v, ['id', 'relationshipType', 'ratio']);
      const ratio = validateRatio(v.ratio);
      return Object.freeze({ id, relationshipType: 'ratio', ratio, frequencyHz: ratioFrequency(seed, ratio) });
    }
    case 'octave': {
      object(v, ['id', 'relationshipType', 'octaveOffset']);
      const offset = v.octaveOffset as number;
      const frequencyHz = octaveFrequency(seed, offset);
      return Object.freeze({ id, relationshipType: 'octave', octaveOffset: offset === 0 ? 0 : offset, frequencyHz });
    }
    default: throw new Error('Tipo de relación desconocido.');
  }
}

type CanonicalRelationship = readonly ['octave', number] | readonly ['ratio', string, string];
function canonicalMember(value: HarmonicMemberV1): CanonicalRelationship {
  if (value.relationshipType === 'root') return ['octave', 0];
  if (value.relationshipType === 'octave') return ['octave', value.octaveOffset];
  const [numerator, denominator] = canonicalRatio(value.ratio);
  const n = BigInt(numerator), d = BigInt(denominator), one = BigInt(1), zero = BigInt(0);
  if ((n & (n - one)) === zero && (d & (d - one)) === zero) {
    // Exact powers of two have one representation, including ratio 1/1 and root.
    return ['octave', n.toString(2).length - d.toString(2).length];
  }
  return ['ratio', numerator, denominator];
}

/**
 * Pure asynchronous data compiler. SHA-256 uses standard Web Crypto (Node/browser).
 * Does not import React, create audio nodes, generate schedules or touch storage.
 *
 * Canonical signature bytes: UTF-8 JSON.stringify of this ordered tuple:
 * ["harmonic-constellation", 1, generationVersion, seed, mode,
 *  sortedCanonicalMembers, mode === "sequence" ? orderedCanonicalMembers : null]
 *
 * Members reduce to exact binary rational quotients. Exact powers of two use
 * ["octave", offset]; other quotients use ["ratio", numeratorString, denominatorString].
 * Sorting is lexical by JSON text, without locale collation. Multiplicity is kept.
 * Sequence order is separately included; simultaneous display order is irrelevant.
 * IDs, names, labels and derived frequencyHz are excluded from mathematical identity.
 * Original operands and unrounded computed frequencies remain in the snapshot.
 * The signature is mathematical identity, not a checksum of all snapshot bytes:
 * equivalent operand scalings can have last-bit differences in IEEE evaluation.
 * The original operands and this generation version reproduce those exact values.
 *
 * Duplicate IDs are rejected. Equal relationships with distinct IDs are retained
 * as explicit repetitions/voices, never silently deduplicated. Simultaneous voice
 * count uses the unchanged voiceGain limit; sequential data has no imposed count
 * limit here. This data contract is NOT an adapter into existing V1 playback.
 */
export async function compileConstellation(input: ConstellationInputV1): Promise<HarmonicConstellationV1> {
  const v = object(input, ['id', 'name', 'seedFrequencyHz', 'members', 'playbackMode']);
  const seedFrequencyHz = frequency(v.seedFrequencyHz as number, 1, 1);
  const id = v.id === undefined ? undefined : text(v.id, 100, true);
  const name = v.name === undefined ? undefined : text(v.name, 200);
  if (v.playbackMode !== 'sequence' && v.playbackMode !== 'simultaneous') throw new Error('Modo inválido.');
  const playbackMode = v.playbackMode;
  if (!Array.isArray(v.members) || !v.members.length) throw new Error('La constelación requiere miembros explícitos.');
  if (playbackMode === 'simultaneous') voiceGain(v.members.length);
  const members = Object.freeze(Array.from(v.members, value => member(value, seedFrequencyHz)));
  if (new Set(members.map(value => value.id)).size !== members.length) throw new Error('Los ID de miembros deben ser únicos.');
  const ordered = members.map(canonicalMember);
  const sorted = [...ordered].sort((a, b) => { const x = JSON.stringify(a), y = JSON.stringify(b); return x < y ? -1 : x > y ? 1 : 0; });
  const payload = JSON.stringify(['harmonic-constellation', 1, CONSTELLATION_GENERATION_VERSION, seedFrequencyHz, playbackMode, sorted, playbackMode === 'sequence' ? ordered : null]);
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  const hex = Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('');
  return Object.freeze({ schemaVersion: 1, id: id ?? `hc-v1-${hex}`, ...(name === undefined ? {} : { name }), seedFrequencyHz,
    members, playbackMode, playbackOrder: playbackMode === 'sequence' ? Object.freeze(members.map(value => value.id)) : null,
    generationVersion: CONSTELLATION_GENERATION_VERSION, signature: `sha256:${hex}` });
}

/** Pure roundtrip verification; no migrations or persisted records are read/written. */
export async function validateConstellation(value: unknown): Promise<HarmonicConstellationV1> {
  const v = object(value, ['schemaVersion', 'id', 'name', 'seedFrequencyHz', 'members', 'playbackMode', 'playbackOrder', 'generationVersion', 'signature']);
  if (v.schemaVersion !== 1 || v.generationVersion !== CONSTELLATION_GENERATION_VERSION || !Array.isArray(v.members)) throw new Error('Versión de constelación desconocida.');
  const supplied = Array.from(v.members, item => ({ ...object(item, ['id', 'relationshipType', 'ratio', 'octaveOffset', 'frequencyHz']) }));
  const signature = v.signature, order = JSON.stringify(v.playbackOrder);
  const definitions = supplied.map(item => {
    const definition = { ...item }; delete definition.frequencyHz;
    return definition as unknown as HarmonicRelationshipV1;
  });
  const result = await compileConstellation({ id: text(v.id, 100, true), ...(v.name === undefined ? {} : { name: text(v.name, 200) }), seedFrequencyHz: v.seedFrequencyHz as number, playbackMode: v.playbackMode as HarmonicConfig['mode'], members: definitions });
  if (signature !== result.signature || order !== JSON.stringify(result.playbackOrder) || supplied.some((item, i) => item.frequencyHz !== result.members[i].frequencyHz)) throw new Error('La constelación no coincide con sus relaciones, orden o firma.');
  return result;
}
