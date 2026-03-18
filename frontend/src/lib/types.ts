// ============================================
// Frequency Healer - Types
// Sistema de frecuencias para sanación
// ============================================

export type FrequencyCategory = 'brainwave' | 'solfeggio' | 'rife' | 'musical' | 'nogier';

export type EvidenceLevel = 'verificada' | 'anecdotica' | 'especulativa';

export type Waveform = 'sine' | 'square' | 'triangle' | 'sawtooth';

export type OutputMode = 'speakers' | 'coils';

export type HealingDomain = 'cuerpo' | 'alma' | 'espiritu';

export interface FrequencyEntry {
  id: string;
  hz: number;
  hzEnd?: number;          // for ranges (e.g., 4-8 Hz)
  name: string;
  description: string;
  category: FrequencyCategory;
  domain: HealingDomain[];
  evidence: EvidenceLevel;
  waveformRecommended: Waveform;
  tags: string[];
  source: string;          // Rife, Solfeggio, MIT, etc.
}

export interface ProtocolStep {
  frequencyHz: number;
  waveform: Waveform;
  durationSeconds: number;
  binaural?: {
    enabled: boolean;
    differenceHz: number;   // binaural beat frequency
  };
  volume: number;           // 0-1
}

export interface Protocol {
  id: string;
  name: string;
  description: string;
  domain: HealingDomain[];
  icon: string;
  color: string;
  steps: ProtocolStep[];
  totalDurationMinutes: number;
}

export interface ToneConfig {
  frequency: number;
  waveform: Waveform;
  volume: number;           // 0-1
  isPlaying: boolean;
  binaural: {
    enabled: boolean;
    differenceHz: number;
  };
  tuning432: boolean;
  outputMode: OutputMode;
  dwellTimeSeconds: number;
}

export interface SessionLog {
  id: string;
  date: string;
  type: 'tone' | 'protocol';
  protocolId?: string;
  frequencyHz: number;
  durationSeconds: number;
  domain: HealingDomain[];
}

export interface UserPreferences {
  outputMode: OutputMode;
  defaultVolume: number;
  tuning432: boolean;
  favorites: string[];      // frequency IDs
  recentFrequencies: string[];
}
