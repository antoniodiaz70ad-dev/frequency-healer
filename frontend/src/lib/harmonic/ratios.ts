import { frequency } from './math';

/** Explicit operands, not a replacement for the named V1 RatioId catalog. */
export interface HarmonicRatioV1 {
  readonly numerator: number;
  readonly denominator: number;
  readonly label?: string;
}
export function validateRatio(value: unknown): HarmonicRatioV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Relación inválida.');
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(key => !['numerator', 'denominator', 'label'].includes(key)) ||
      typeof v.numerator !== 'number' || !Number.isFinite(v.numerator) || v.numerator <= 0 ||
      typeof v.denominator !== 'number' || !Number.isFinite(v.denominator) || v.denominator <= 0 ||
      (v.label !== undefined && (typeof v.label !== 'string' || v.label.length > 120))) throw new Error('Relación inválida: operandos positivos y finitos.');
  return Object.freeze({ numerator: v.numerator, denominator: v.denominator, ...(v.label === undefined ? {} : { label: v.label as string }) });
}

/** No rounding, folding or clamping. Bounds remain owned by math.frequency. */
export function ratioFrequency(seedFrequencyHz: number, value: HarmonicRatioV1): number {
  const ratio = validateRatio(value);
  frequency(seedFrequencyHz, 1, 1); // Validate the seed even when the ratio would bring it into range.
  const product = seedFrequencyHz * ratio.numerator;
  if (!Number.isFinite(product) || product < 2 ** -1022) {
    // Avoid intermediate overflow or loss of precision in subnormal products,
    // e.g. 1e308 / 1e308 or Number.MIN_VALUE / Number.MIN_VALUE.
    // The ordinary path, including every named V1 ratio, retains the old evaluation order.
    return frequency(seedFrequencyHz, ratio.numerator / ratio.denominator, 1);
  }
  return frequency(seedFrequencyHz, ratio.numerator, ratio.denominator);
}

const ONE = BigInt(1), ZERO = BigInt(0), MANTISSA_BITS = BigInt(52);
function gcd(a: bigint, b: bigint): bigint {
  while (b !== ZERO) { const remainder = a % b; a = b; b = remainder; }
  return a;
}
/** Exact rational value of an already-validated positive IEEE-754 number. */
function binaryFraction(value: number): readonly [bigint, bigint] {
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value, false);
  const bits = view.getBigUint64(0, false);
  const exponent = Number((bits >> MANTISSA_BITS) & BigInt(2047));
  const fraction = bits & ((ONE << MANTISSA_BITS) - ONE);
  const significand = exponent === 0 ? fraction : fraction + (ONE << MANTISSA_BITS);
  const shift = (exponent === 0 ? -1022 : exponent - 1023) - 52;
  return shift >= 0 ? [significand << BigInt(shift), ONE] : [significand, ONE << BigInt(-shift)];
}

/**
 * Canonical identity is the reduced exact quotient of the supplied binary numbers.
 * No epsilon, decimal rounding or "nearest musical ratio" conversion is used.
 * 6/4 and 1.5/1 become 3/2; 0.3/0.2 does NOT become 3/2, because those input
 * doubles do not have that exact quotient. Original operands remain in snapshots.
 * This identity does not change the existing floating-point frequency evaluation.
 */
export function canonicalRatio(value: HarmonicRatioV1): readonly [string, string] {
  const ratio = validateRatio(value);
  const [pn, pd] = binaryFraction(ratio.numerator), [qn, qd] = binaryFraction(ratio.denominator);
  const numerator = pn * qd, denominator = pd * qn, divisor = gcd(numerator, denominator);
  return Object.freeze([(numerator / divisor).toString(), (denominator / divisor).toString()]);
}
