import type { Waveform } from '@/lib/types';

export type SurfaceType = 'square-plate' | 'circular-membrane';
export type CymaticsView = 'field' | 'particles';
export type VisualScale = 'fixed' | 'auto';
export type RenderQuality = 'low' | 'medium' | 'high';

export interface CymaticsConfigV1 {
  schemaVersion: 1;
  modelVersion: 'cymatics-modal-v1';
  id: string;
  createdAt: string;
  title: string;
  surfaceType: SurfaceType;
  boundaryCondition: 'simply-supported' | 'fixed-edge';
  dimensionsSI: { widthM: number; heightM: number; thicknessM: number; radiusM: number };
  materialSI: { youngModulusPa: number; poissonRatio: number; densityKgM3: number; tensionNm: number; surfaceDensityKgM2: number };
  excitationPosition: { x: number; y: number };
  excitationRelativeStrength: number;
  damping: number;
  audioMode: 'mono' | 'binaural';
  channelFrequenciesHz: number[];
  waveform: Waveform;
  modeledComponents: number[];
  responseMethod: 'steady-state-modal-rms';
  modeCutoff: number;
  visualScale: VisualScale;
  autoExposure: boolean;
  particleSeed: number;
  simulationTimeSeconds: number;
  renderQuality: RenderQuality;
  view: CymaticsView;
}

export interface ModalField {
  size: number;
  values: Float32Array;
  maxAmplitude: number;
  rmsAmplitude: number;
  nearestResonanceHz: number;
  modeledMinHz: number;
  modeledMaxHz: number;
  status: 'weak' | 'mixed' | 'resonant' | 'outside-modeled-range';
}

export interface SavedCymaticsFigure { config: CymaticsConfigV1; }
