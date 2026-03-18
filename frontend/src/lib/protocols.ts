import { Protocol } from './types';

/**
 * Protocolos de sanación pre-configurados.
 * Secuencias de frecuencias con duraciones y parámetros específicos.
 */
export const PROTOCOLS: Protocol[] = [
  {
    id: 'solfeggio-ascension',
    name: 'Ascensión Solfeggio',
    description: 'Recorre las 9 frecuencias Solfeggio sagradas. Limpieza y elevación completa de cuerpo, alma y espíritu.',
    domain: ['cuerpo', 'alma', 'espiritu'],
    icon: '🎵',
    color: '#fbbf24',
    totalDurationMinutes: 18,
    steps: [
      { frequencyHz: 174, waveform: 'sine', durationSeconds: 120, volume: 0.5 },
      { frequencyHz: 285, waveform: 'sine', durationSeconds: 120, volume: 0.5 },
      { frequencyHz: 396, waveform: 'sine', durationSeconds: 120, volume: 0.5 },
      { frequencyHz: 417, waveform: 'sine', durationSeconds: 120, volume: 0.5 },
      { frequencyHz: 528, waveform: 'sine', durationSeconds: 120, volume: 0.5 },
      { frequencyHz: 639, waveform: 'sine', durationSeconds: 120, volume: 0.5 },
      { frequencyHz: 741, waveform: 'sine', durationSeconds: 120, volume: 0.5 },
      { frequencyHz: 852, waveform: 'sine', durationSeconds: 120, volume: 0.5 },
      { frequencyHz: 963, waveform: 'sine', durationSeconds: 120, volume: 0.5 },
    ],
  },
  {
    id: 'sanacion-cuerpo',
    name: 'Sanación del Cuerpo',
    description: 'Protocolo Rife antimicrobiano. Antibacteriano, antiviral e inmunológico con onda cuadrada.',
    domain: ['cuerpo'],
    icon: '🫀',
    color: '#f87171',
    totalDurationMinutes: 12,
    steps: [
      { frequencyHz: 727, waveform: 'square', durationSeconds: 180, volume: 0.4 },
      { frequencyHz: 787, waveform: 'square', durationSeconds: 180, volume: 0.4 },
      { frequencyHz: 880, waveform: 'square', durationSeconds: 180, volume: 0.4 },
      { frequencyHz: 1550, waveform: 'square', durationSeconds: 180, volume: 0.4 },
    ],
  },
  {
    id: 'meditacion-profunda',
    name: 'Meditación Profunda',
    description: 'Descenso gradual desde Schumann hasta Epsilon. Binaural beats para inducir estados meditativos profundos.',
    domain: ['alma', 'espiritu'],
    icon: '🧘',
    color: '#a78bfa',
    totalDurationMinutes: 20,
    steps: [
      { frequencyHz: 7.83, waveform: 'sine', durationSeconds: 300, volume: 0.4, binaural: { enabled: true, differenceHz: 7.83 } },
      { frequencyHz: 200, waveform: 'sine', durationSeconds: 300, volume: 0.35, binaural: { enabled: true, differenceHz: 4 } },
      { frequencyHz: 200, waveform: 'sine', durationSeconds: 300, volume: 0.3, binaural: { enabled: true, differenceHz: 2 } },
      { frequencyHz: 200, waveform: 'sine', durationSeconds: 300, volume: 0.25, binaural: { enabled: true, differenceHz: 0.5 } },
    ],
  },
  {
    id: 'gamma-neuroproteccion',
    name: 'Gamma Neuroprotección',
    description: 'Frecuencia gamma 40 Hz sostenida. Basado en investigación MIT sobre reducción de placas amiloides en Alzheimer.',
    domain: ['cuerpo', 'alma'],
    icon: '🧠',
    color: '#60a5fa',
    totalDurationMinutes: 30,
    steps: [
      { frequencyHz: 200, waveform: 'sine', durationSeconds: 1800, volume: 0.4, binaural: { enabled: true, differenceHz: 40 } },
    ],
  },
  {
    id: 'desintoxicacion',
    name: 'Desintoxicación',
    description: 'Protocolo Rife/CAFL para desintoxicación. Elimina parásitos y bacterias con frecuencias específicas.',
    domain: ['cuerpo'],
    icon: '🧹',
    color: '#4ade80',
    totalDurationMinutes: 15,
    steps: [
      { frequencyHz: 1150, waveform: 'square', durationSeconds: 300, volume: 0.4 },
      { frequencyHz: 306, waveform: 'square', durationSeconds: 300, volume: 0.4 },
      { frequencyHz: 727, waveform: 'square', durationSeconds: 300, volume: 0.4 },
    ],
  },
  {
    id: 'sueno-profundo',
    name: 'Sueño Profundo',
    description: 'Descenso gradual de alpha a delta. Usa binaural beats para inducir sueño reparador naturalmente.',
    domain: ['cuerpo', 'alma'],
    icon: '🌙',
    color: '#818cf8',
    totalDurationMinutes: 25,
    steps: [
      { frequencyHz: 200, waveform: 'sine', durationSeconds: 300, volume: 0.35, binaural: { enabled: true, differenceHz: 10 } },
      { frequencyHz: 200, waveform: 'sine', durationSeconds: 300, volume: 0.3, binaural: { enabled: true, differenceHz: 8 } },
      { frequencyHz: 200, waveform: 'sine', durationSeconds: 300, volume: 0.25, binaural: { enabled: true, differenceHz: 4 } },
      { frequencyHz: 200, waveform: 'sine', durationSeconds: 300, volume: 0.2, binaural: { enabled: true, differenceHz: 2 } },
      { frequencyHz: 200, waveform: 'sine', durationSeconds: 300, volume: 0.15, binaural: { enabled: true, differenceHz: 0.5 } },
    ],
  },
  {
    id: 'equilibrio-432',
    name: 'Equilibrio 432 Hz',
    description: 'Baño sonoro en 432 Hz con armónicos naturales. La afinación de las catedrales antiguas.',
    domain: ['cuerpo', 'alma'],
    icon: '🎶',
    color: '#4ade80',
    totalDurationMinutes: 15,
    steps: [
      { frequencyHz: 108, waveform: 'sine', durationSeconds: 180, volume: 0.4 },
      { frequencyHz: 216, waveform: 'sine', durationSeconds: 180, volume: 0.4 },
      { frequencyHz: 432, waveform: 'sine', durationSeconds: 240, volume: 0.45 },
      { frequencyHz: 864, waveform: 'sine', durationSeconds: 180, volume: 0.35 },
      { frequencyHz: 432, waveform: 'sine', durationSeconds: 120, volume: 0.4 },
    ],
  },
  {
    id: 'despertar-espiritual',
    name: 'Despertar Espiritual',
    description: 'Frecuencias Solfeggio superiores para activación espiritual. Tercer ojo, corona y conexión divina.',
    domain: ['espiritu'],
    icon: '✨',
    color: '#67e8f9',
    totalDurationMinutes: 15,
    steps: [
      { frequencyHz: 741, waveform: 'sine', durationSeconds: 300, volume: 0.4 },
      { frequencyHz: 852, waveform: 'sine', durationSeconds: 300, volume: 0.4 },
      { frequencyHz: 963, waveform: 'sine', durationSeconds: 300, volume: 0.4 },
    ],
  },
  {
    id: 'frecuencia-milagro',
    name: 'Frecuencia del Milagro',
    description: '528 Hz sostenida — la frecuencia del amor y la reparación del ADN. La más poderosa del Solfeggio.',
    domain: ['cuerpo', 'alma', 'espiritu'],
    icon: '💎',
    color: '#fbbf24',
    totalDurationMinutes: 20,
    steps: [
      { frequencyHz: 528, waveform: 'sine', durationSeconds: 1200, volume: 0.45 },
    ],
  },
  {
    id: 'antiparasitario',
    name: 'Antiparasitario Completo',
    description: 'Protocolo CAFL completo para parásitos. Múltiples frecuencias con onda cuadrada para máxima efectividad.',
    domain: ['cuerpo'],
    icon: '🛡️',
    color: '#f87171',
    totalDurationMinutes: 15,
    steps: [
      { frequencyHz: 993.98, waveform: 'square', durationSeconds: 300, volume: 0.4 },
      { frequencyHz: 1150, waveform: 'square', durationSeconds: 300, volume: 0.4 },
      { frequencyHz: 2112, waveform: 'square', durationSeconds: 300, volume: 0.4 },
    ],
  },
];

export function getProtocolById(id: string): Protocol | undefined {
  return PROTOCOLS.find((p) => p.id === id);
}

export function getProtocolsByDomain(domain: string): Protocol[] {
  return PROTOCOLS.filter((p) => p.domain.includes(domain as 'cuerpo' | 'alma' | 'espiritu'));
}
