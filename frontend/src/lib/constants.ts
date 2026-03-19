// ============================================
// Frequency Healer - Constants
// Valores centralizados para audio, UI y configuración
// ============================================

export const AUDIO = {
  FADE_IN_S: 0.08,
  FADE_OUT_S: 0.05,
  CROSSFADE_S: 0.2,
  VOLUME_RAMP_S: 0.05,
  FREQUENCY_RAMP_S: 0.1,
  MIN_FREQUENCY_HZ: 0.1,
  MAX_FREQUENCY_HZ: 22000,
  DEFAULT_FREQUENCY_HZ: 528,
  DEFAULT_VOLUME: 0.5,
  COILS_MAX_VOLUME: 0.8,
  SAMPLE_RATE: 44100,
  FFT_SIZE: 2048,
  BINAURAL_MIN_DIFF_HZ: 0.5,
  BINAURAL_MAX_DIFF_HZ: 40,
  MAX_DWELL_S: 3600,
} as const;

export const COMPRESSOR = {
  THRESHOLD: -6,
  KNEE: 12,
  RATIO: 4,
  ATTACK: 0.003,
  RELEASE: 0.1,
} as const;

export const UI = {
  TIMER_INTERVAL_MS: 250,
  CANVAS_BG_COLOR: '#0d1117',
  SIDEBAR_WIDTH_PX: 256,
  FREQUENCY_MATCH_THRESHOLD_HZ: 0.5,
  LIBRARY_PLAY_VOLUME: 0.4,
} as const;
