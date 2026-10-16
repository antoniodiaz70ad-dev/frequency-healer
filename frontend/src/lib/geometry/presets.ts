import { GEOMETRY_ENGINE_VERSION, type GeometryConfig } from './types';

const preset = (value: Omit<GeometryConfig, 'classification' | 'engineVersion'>): GeometryConfig => ({
  ...value, classification: 'ARTISTIC_GEOMETRY', engineVersion: GEOMETRY_ENGINE_VERSION,
});

export const GEOMETRY_PRESETS: readonly GeometryConfig[] = [
  preset({ id:'reference-33', name:'Órbita tríada', family:'orbital-circles', acousticFrequencyHz:33, vertices:6, step:1, symmetry:3, rotationDeg:0, phase:.08, scale:.82, color:'#79e16c' }),
  preset({ id:'reference-66', name:'Rueda hexagonal', family:'radial-wheel', acousticFrequencyHz:66, vertices:6, step:1, symmetry:6, rotationDeg:0, phase:.16, scale:.88, color:'#d7efa2' }),
  preset({ id:'reference-99', name:'Rueda solar', family:'radial-wheel', acousticFrequencyHz:99, vertices:9, step:4, symmetry:12, rotationDeg:7.5, phase:.28, scale:.9, color:'#ff8d68' }),
  preset({ id:'reference-333', name:'Órbitas entrelazadas', family:'orbital-circles', acousticFrequencyHz:333, vertices:9, step:2, symmetry:4, rotationDeg:45, phase:.42, scale:.78, color:'#ba91ff' }),
  preset({ id:'reference-666', name:'Estrella compuesta', family:'star-polygon', acousticFrequencyHz:666, vertices:12, step:4, symmetry:6, rotationDeg:15, phase:.55, scale:.86, color:'#ffc0d8' }),
  preset({ id:'reference-999', name:'Lissajous 9:6', family:'lissajous', acousticFrequencyHz:999, vertices:9, step:4, symmetry:6, rotationDeg:0, phase:.66, scale:.82, color:'#72e6a0' }),
  preset({ id:'reference-1998', name:'Corona polar', family:'polar', acousticFrequencyHz:1998, vertices:18, step:7, symmetry:18, rotationDeg:0, phase:.82, scale:.92, color:'#f4f3df' }),
] as const;

export function cloneGeometryConfig(config: GeometryConfig): GeometryConfig { return { ...config }; }
