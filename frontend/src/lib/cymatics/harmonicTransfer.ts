import { validateConstellation, type HarmonicConstellationV1, type HarmonicMemberV1 } from '../harmonic/constellations';

export const HARMONIC_CYMATICS_TRANSFER_VERSION = 'harmonic-to-cymatics-v1' as const;

export interface HarmonicCymaticsTransferV1 {
  readonly schemaVersion: 1;
  readonly transferVersion: typeof HARMONIC_CYMATICS_TRANSFER_VERSION;
  readonly constellationId: string;
  readonly constellationSignature: string;
  readonly constellationGenerationVersion: HarmonicConstellationV1['generationVersion'];
  readonly name?: string;
  readonly seedFrequencyHz: number;
  readonly playbackMode: HarmonicConstellationV1['playbackMode'];
  readonly playbackOrder: readonly string[] | null;
  readonly members: readonly HarmonicMemberV1[];
}

/**
 * Creates a detached, validated review payload. Frequencies remain excitation
 * candidates; this contract never converts a harmonic relation into a physical mode.
 */
export async function createHarmonicCymaticsTransfer(value: unknown): Promise<HarmonicCymaticsTransferV1> {
  const source = await validateConstellation(value);
  return Object.freeze({
    schemaVersion: 1,
    transferVersion: HARMONIC_CYMATICS_TRANSFER_VERSION,
    constellationId: source.id,
    constellationSignature: source.signature,
    constellationGenerationVersion: source.generationVersion,
    ...(source.name === undefined ? {} : { name: source.name }),
    seedFrequencyHz: source.seedFrequencyHz,
    playbackMode: source.playbackMode,
    playbackOrder: source.playbackOrder ? Object.freeze([...source.playbackOrder]) : null,
    members: Object.freeze(source.members.map(member => Object.freeze(structuredClone(member)))),
  });
}

export function transferMemberLabel(member: HarmonicMemberV1): string {
  if (member.relationshipType === 'root') return 'Raíz · 1:1';
  if (member.relationshipType === 'ratio') return `Ratio · ${member.ratio.numerator}:${member.ratio.denominator}`;
  return `Octava · ${member.octaveOffset > 0 ? '+' : ''}${member.octaveOffset}`;
}

export function selectTransferMembers(transfer: HarmonicCymaticsTransferV1, ids: readonly string[], limit = 2): HarmonicMemberV1[] {
  if (!Number.isInteger(limit) || limit < 1 || ids.length < 1 || ids.length > limit || new Set(ids).size !== ids.length) throw new Error(`Selecciona entre 1 y ${limit} miembros distintos.`);
  return ids.map(id => {
    const member = transfer.members.find(candidate => candidate.id === id);
    if (!member) throw new Error('La selección ya no coincide con la constelación revisada.');
    return member;
  });
}
