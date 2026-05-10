import { FocusLevelPreset } from './types';

/**
 * Focus Level presets inspirados en el modelo de fases del Instituto Monroe.
 *
 * Cada preset es un "acorde" multicapa de batidos binaurales (no una sola
 * frecuencia) más un nivel sugerido de ruido rosa de fondo. Las portadoras se
 * mantienen siempre por debajo de 1500 Hz, umbral por encima del cual los
 * núcleos olivares dejan de inducir el diferencial de fase necesario para la
 * Respuesta de Seguimiento de Frecuencia (FFR).
 *
 * Los nombres "Focus N" describen amplitudes de consciencia, no son marca
 * registrada del Instituto Monroe — esta plataforma reconstruye el método
 * de forma independiente sin redistribuir audio licenciado.
 */

export const FOCUS_LEVEL_PRESETS: FocusLevelPreset[] = [
  {
    id: 'f10',
    label: 'Focus 10 — Mente despierta, cuerpo dormido',
    description:
      'Atonía motora análoga al sueño NREM mientras la mente se mantiene lúcida. Acorde en frontera delta-theta.',
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
    label: 'Focus 12 — Conciencia expandida',
    description:
      'Sobre el acorde de F10 se añade una capa alfa rápida. Útil para resolución heurística, creatividad y visualización.',
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
    label: 'Focus 15 — El no-tiempo (vacío)',
    description:
      'Aislamiento de ritmos circadianos. Theta alta superpuesta al acorde de F10. El tiempo lineal se desdibuja.',
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
    label: 'Focus 21 — El puente',
    description:
      'Mezcla delta + theta + alfa baja. Estado liminal entre la percepción del continuo físico y otros marcos de referencia.',
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
      'Capa única estilo Tesla 3-6-9 con beat theta sutil. Alternativa relajada para usuarios sensibles a binaurales puros.',
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
    label: '528 Hz — Reparación',
    description:
      'Solfeggio de transformación con beat alfa. Foco en relajación atenta y reducción de ansiedad somática.',
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
    label: '432 Hz — Natural',
    description:
      'Afinación natural con beat alfa-theta. Compromiso suave entre profundidad y mantenimiento de lucidez.',
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
