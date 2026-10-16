export const GEOMETRY_ENGINE_VERSION = 'resonance-geometry-v1' as const;

export type GeometryFamily = 'star-polygon' | 'orbital-circles' | 'radial-wheel' | 'lissajous' | 'polar';

export type GeometryConfig = {
  id: string;
  name: string;
  classification: 'ARTISTIC_GEOMETRY';
  engineVersion: typeof GEOMETRY_ENGINE_VERSION;
  family: GeometryFamily;
  acousticFrequencyHz: number;
  vertices: number;
  step: number;
  symmetry: number;
  rotationDeg: number;
  phase: number;
  scale: number;
  color: string;
};

export type GeometryPoint = { x: number; y: number };
export type GeometryCircle = GeometryPoint & { radius: number };
export type GeometryScene = {
  polylines: GeometryPoint[][];
  circles: GeometryCircle[];
  radialLines: Array<{ from: GeometryPoint; to: GeometryPoint }>;
};
