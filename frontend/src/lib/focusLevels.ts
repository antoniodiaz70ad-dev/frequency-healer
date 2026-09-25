import { FocusLevelPreset } from './types';

/**
 * Presets históricos inspirados en etiquetas Focus.
 *
 * Cada preset es un "acorde" multicapa de batidos binaurales (no una sola
 * frecuencia) más un nivel sugerido de ruido rosa de fondo. Las portadoras se
 * mantienen siempre por debajo de 1500 Hz. La aplicación no mide respuesta
 * neurológica ni presupone un efecto por la diferencia binaural.
 *
 * Los nombres "Focus N" se conservan como referencias históricas; no describen
 * estados garantizados ni implican afiliación con el Instituto Monroe.
 */

export const FOCUS_LEVEL_PRESETS: FocusLevelPreset[] = [
  {
    id: 'f10',
    label: 'Focus 10 — Referencia histórica',
    description:
      'Acorde binaural delta-theta para exploración subjetiva. No se afirma atonía, sueño NREM ni lucidez específica.',
    bands: ['delta', 'theta'],
    layers: [
      { carrierHz: 100, beatHz: 4.0, gain: 0.35, waveform: 'sine' },
      { carrierHz: 150, beatHz: 6.3, gain: 0.25, waveform: 'sine' },
    ],
    pinkNoiseGain: 0.08,
    color: '#a78bfa',
    durationMinutes: 30,
  },
  {
    id: 'f12',
    label: 'Focus 12 — Referencia histórica',
    description:
      'Añade una capa Alpha al acorde anterior. Creatividad y visualización son intenciones exploratorias, no resultados garantizados.',
    bands: ['delta', 'theta', 'alpha'],
    layers: [
      { carrierHz: 100, beatHz: 4.0, gain: 0.30, waveform: 'sine' },
      { carrierHz: 150, beatHz: 6.3, gain: 0.22, waveform: 'sine' },
      { carrierHz: 200, beatHz: 10.5, gain: 0.20, waveform: 'sine' },
    ],
    pinkNoiseGain: 0.07,
    color: '#67e8f9',
    durationMinutes: 30,
  },
  {
    id: 'f15',
    label: 'Focus 15 — Referencia histórica',
    description:
      'Superpone Theta alta al acorde inicial. No se afirma aislamiento circadiano ni alteración objetiva de la percepción temporal.',
    bands: ['delta', 'theta'],
    layers: [
      { carrierHz: 100, beatHz: 3.5, gain: 0.32, waveform: 'sine' },
      { carrierHz: 140, beatHz: 6.5, gain: 0.26, waveform: 'sine' },
      { carrierHz: 180, beatHz: 7.5, gain: 0.20, waveform: 'sine' },
    ],
    pinkNoiseGain: 0.10,
    color: '#818cf8',
    durationMinutes: 45,
  },
  {
    id: 'f21',
    label: 'Focus 21 — Referencia histórica',
    description:
      'Mezcla Delta, Theta y Alpha baja para exploración subjetiva. La etiqueta de “puente” es una referencia histórica.',
    bands: ['delta', 'theta', 'alpha'],
    layers: [
      { carrierHz: 90, beatHz: 2.5, gain: 0.30, waveform: 'sine' },
      { carrierHz: 130, beatHz: 5.5, gain: 0.24, waveform: 'sine' },
      { carrierHz: 170, beatHz: 8.5, gain: 0.20, waveform: 'sine' },
    ],
    pinkNoiseGain: 0.09,
    color: '#c084fc',
    durationMinutes: 45,
  },
];

export const SOLFEGGIO_CHORDS: FocusLevelPreset[] = [
  {
    id: 'solf-369',
    label: '369 Hz — Tesla',
    description:
      'Capa de 369 Hz con diferencia Theta. La referencia “Tesla 3-6-9” es popular e histórica, sin atribución causal.',
    bands: ['theta'],
    layers: [
      { carrierHz: 369, beatHz: 6.0, gain: 0.40, waveform: 'sine' },
    ],
    pinkNoiseGain: 0.12,
    color: '#fbbf24',
    durationMinutes: 30,
  },
  {
    id: 'solf-528',
    label: '528 Hz — Solfeggio histórico',
    description:
      'Tono Solfeggio con diferencia Alpha para exploración subjetiva. No se afirma reparación ni reducción de ansiedad.',
    bands: ['alpha'],
    layers: [
      { carrierHz: 528, beatHz: 10.0, gain: 0.35, waveform: 'sine' },
      { carrierHz: 264, beatHz: 8.0, gain: 0.20, waveform: 'sine' },
    ],
    pinkNoiseGain: 0.08,
    color: '#4ade80',
    durationMinutes: 30,
  },
  {
    id: 'solf-432',
    label: '432 Hz — Afinación alternativa',
    description:
      'Afinación alternativa con diferencias Alpha y Theta. “Natural” y sus efectos asociados no se consideran establecidos.',
    bands: ['alpha', 'theta'],
    layers: [
      { carrierHz: 216, beatHz: 7.83, gain: 0.32, waveform: 'sine' },
      { carrierHz: 432, beatHz: 10.0, gain: 0.25, waveform: 'sine' },
    ],
    pinkNoiseGain: 0.08,
    color: '#34d399',
    durationMinutes: 30,
  },
];

export const ALL_CHORD_PRESETS = [...FOCUS_LEVEL_PRESETS, ...SOLFEGGIO_CHORDS];

export const BAND_LABEL: Record<string, string> = {
  delta: 'Δ Delta',
  theta: 'Θ Theta',
  alpha: 'α Alpha',
  beta: 'β Beta',
  gamma: 'γ Gamma',
};
