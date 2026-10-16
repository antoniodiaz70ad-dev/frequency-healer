import type { GeometryConfig } from './types';

export const GEOMETRY_LIMITS = {
  acousticFrequencyHz: [0.1, 20_000], vertices: [3, 72], step: [1, 71], symmetry: [1, 36],
  rotationDeg: [-360, 360], phase: [0, 1], scale: [0.35, 1],
} as const;

export type StarParameters = Pick<GeometryConfig, 'vertices' | 'step'>;

const finiteInteger = (value: number, fallback: number) => Number.isFinite(value) ? Math.round(value) : fallback;

/** Keeps the coupled {n/k} controls valid after either value changes. */
export function normalizeStarParameters(current: StarParameters, change: Partial<StarParameters>): StarParameters {
  const [minimumVertices, maximumVertices] = GEOMETRY_LIMITS.vertices;
  const [minimumStep, maximumStep] = GEOMETRY_LIMITS.step;
  const vertices = Math.max(minimumVertices, Math.min(maximumVertices,
    finiteInteger(change.vertices ?? current.vertices, current.vertices)));
  const step = Math.max(minimumStep, Math.min(maximumStep, vertices - 1,
    finiteInteger(change.step ?? current.step, current.step)));
  return { vertices, step };
}

export function greatestCommonDivisor(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y) [x, y] = [y, x % y];
  return x;
}

export function starCycleCount(vertices: number, step: number): number {
  return greatestCommonDivisor(vertices, step);
}

export function starKind(vertices: number, step: number): 'single-cycle' | 'compound' {
  return starCycleCount(vertices, step) === 1 ? 'single-cycle' : 'compound';
}

export function validateGeometryConfig(config: GeometryConfig): string[] {
  const errors: string[] = [];
  const numeric: Array<[keyof typeof GEOMETRY_LIMITS, number]> = [
    ['acousticFrequencyHz', config.acousticFrequencyHz], ['vertices', config.vertices], ['step', config.step],
    ['symmetry', config.symmetry], ['rotationDeg', config.rotationDeg], ['phase', config.phase], ['scale', config.scale],
  ];
  for (const [key, value] of numeric) {
    const [min, max] = GEOMETRY_LIMITS[key];
    if (!Number.isFinite(value) || value < min || value > max) errors.push(`${key} fuera de rango`);
  }
  if (!Number.isInteger(config.vertices)) errors.push('vertices debe ser entero');
  if (!Number.isInteger(config.step) || config.step >= config.vertices) errors.push('step debe ser entero y menor que vertices');
  if (!Number.isInteger(config.symmetry)) errors.push('symmetry debe ser entero');
  if (!/^#[0-9a-f]{6}$/i.test(config.color)) errors.push('color debe usar formato hexadecimal');
  if (config.classification !== 'ARTISTIC_GEOMETRY') errors.push('clasificación inválida');
  return errors;
}
