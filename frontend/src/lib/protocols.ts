import { Protocol } from './types';

/**
 * Protocolos históricos pre-configurados.
 * Secuencias de frecuencias con duraciones y parámetros específicos.
 */
export const PROTOCOLS: Protocol[] = [
  {
    id: 'solfeggio-ascension',
    name: 'Ascensión Solfeggio',
    description: 'Recorrido histórico por nueve tonos asociados a la tradición Solfeggio. Las atribuciones espirituales se conservan solo como contexto cultural no validado.',
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
    name: 'Secuencia Rife corporal (histórica)',
    description: 'Secuencia heredada de tonos cuadrados atribuida a fuentes Rife/CAFL. El catálogo no representa evidencia de efectos antimicrobianos, antivirales o inmunológicos.',
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
    description: 'Secuencia binaural descendente para exploración meditativa subjetiva. No se afirma que induzca un estado fisiológico específico.',
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
    name: 'Gamma 40 Hz (histórico)',
    description: 'Secuencia binaural heredada de 40 Hz. No representa tratamiento, neuroprotección ni evidencia clínica sobre Alzheimer.',
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
    description: 'Secuencia heredada atribuida a listas Rife/CAFL. No se presenta como desintoxicación ni como tratamiento de parásitos o bacterias.',
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
    description: 'Recorrido binaural descendente para una rutina exploratoria previa al descanso. No promete inducir sueño ni producir efectos reparadores.',
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
    description: 'Recorrido sonoro por múltiplos de 432 Hz. Las asociaciones históricas atribuidas a esta afinación no se tratan como evidencia de bienestar.',
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
    description: 'Recorrido histórico por tonos Solfeggio altos. Las asociaciones con tercer ojo, corona o conexión divina son referencias espirituales exploratorias.',
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
    name: '528 Hz Solfeggio (histórico)',
    description: 'Tono sostenido de 528 Hz, asociado en fuentes populares con amor o reparación del ADN. Esas afirmaciones no se consideran evidencia establecida.',
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
    name: 'Secuencia CAFL múltiple (histórica)',
    description: 'Secuencia heredada de tonos cuadrados atribuida a listas CAFL. No se presenta como tratamiento antiparasitario ni se afirma efectividad médica.',
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

  // ─── PROTOCOLOS RESONANCIA ALFA ──────────────────────────────────
  {
    id: 'resonancia-alfa-iq',
    name: 'Recorrido Alpha 8–13 Hz',
    description: 'Escala binaural progresiva de 8 a 13 Hz. No se atribuyen aumentos de IQ, genialidad ni entrenamiento de coherencia cerebral.',
    domain: ['alma'],
    icon: '🧠',
    color: '#60a5fa',
    totalDurationMinutes: 25,
    steps: [
      { frequencyHz: 200, waveform: 'sine', durationSeconds: 300, volume: 0.35, binaural: { enabled: true, differenceHz: 8 } },
      { frequencyHz: 200, waveform: 'sine', durationSeconds: 300, volume: 0.35, binaural: { enabled: true, differenceHz: 10 } },
      { frequencyHz: 200, waveform: 'sine', durationSeconds: 300, volume: 0.35, binaural: { enabled: true, differenceHz: 11 } },
      { frequencyHz: 200, waveform: 'sine', durationSeconds: 300, volume: 0.35, binaural: { enabled: true, differenceHz: 12 } },
      { frequencyHz: 200, waveform: 'sine', durationSeconds: 300, volume: 0.35, binaural: { enabled: true, differenceHz: 13 } },
    ],
  },
  {
    id: 'samadhi-alpha',
    name: 'Samadhi — Alpha Continuo',
    description: 'Secuencia Alpha inspirada en una referencia cultural a Samadhi. No se prometen imperturbabilidad ni cambios cognitivos o fisiológicos.',
    domain: ['alma', 'espiritu'],
    icon: '🪷',
    color: '#f59e0b',
    totalDurationMinutes: 30,
    steps: [
      { frequencyHz: 200, waveform: 'sine', durationSeconds: 300, volume: 0.3, binaural: { enabled: true, differenceHz: 8 } },
      { frequencyHz: 200, waveform: 'sine', durationSeconds: 1500, volume: 0.35, binaural: { enabled: true, differenceHz: 10 } },
    ],
  },
  {
    id: 'satori-alpha',
    name: 'Satori — Alpha Reactivo',
    description: 'Secuencia Alpha variable inspirada en una referencia cultural a Satori. No se atribuyen reactividad o supresión neurológica medibles.',
    domain: ['alma', 'espiritu'],
    icon: '⛩️',
    color: '#ef4444',
    totalDurationMinutes: 20,
    steps: [
      { frequencyHz: 200, waveform: 'sine', durationSeconds: 240, volume: 0.35, binaural: { enabled: true, differenceHz: 10 } },
      { frequencyHz: 200, waveform: 'sine', durationSeconds: 360, volume: 0.35, binaural: { enabled: true, differenceHz: 12 } },
      { frequencyHz: 200, waveform: 'sine', durationSeconds: 120, volume: 0.1, binaural: { enabled: true, differenceHz: 13 } },
      { frequencyHz: 200, waveform: 'sine', durationSeconds: 360, volume: 0.35, binaural: { enabled: true, differenceHz: 13 } },
      { frequencyHz: 200, waveform: 'sine', durationSeconds: 120, volume: 0.1, binaural: { enabled: true, differenceHz: 12 } },
    ],
  },
  {
    id: 'neurofeedback-alfa',
    name: 'Alpha con tono intercalado',
    description: 'Secuencia Alpha con un tono intercalado de 600 Hz. La app no mide EEG y esta reproducción no equivale a neurofeedback.',
    domain: ['alma'],
    icon: '🎯',
    color: '#10b981',
    totalDurationMinutes: 20,
    steps: [
      { frequencyHz: 200, waveform: 'sine', durationSeconds: 300, volume: 0.3, binaural: { enabled: true, differenceHz: 10 } },
      { frequencyHz: 600, waveform: 'sine', durationSeconds: 60, volume: 0.25 },
      { frequencyHz: 200, waveform: 'sine', durationSeconds: 300, volume: 0.3, binaural: { enabled: true, differenceHz: 11 } },
      { frequencyHz: 600, waveform: 'sine', durationSeconds: 60, volume: 0.25 },
      { frequencyHz: 200, waveform: 'sine', durationSeconds: 300, volume: 0.3, binaural: { enabled: true, differenceHz: 12 } },
      { frequencyHz: 600, waveform: 'sine', durationSeconds: 60, volume: 0.25 },
      { frequencyHz: 200, waveform: 'sine', durationSeconds: 120, volume: 0.3, binaural: { enabled: true, differenceHz: 12 } },
    ],
  },
  {
    id: 'sincronizacion-grupal',
    name: 'Secuencia Alpha grupal (histórica)',
    description: 'Secuencia Alpha heredada para exploración grupal. No se afirma sincronización mental, coherencia cerebral ni aumento del rendimiento.',
    domain: ['alma', 'espiritu'],
    icon: '🔗',
    color: '#8b5cf6',
    totalDurationMinutes: 25,
    steps: [
      { frequencyHz: 200, waveform: 'sine', durationSeconds: 300, volume: 0.3, binaural: { enabled: true, differenceHz: 7.83 } },
      { frequencyHz: 200, waveform: 'sine', durationSeconds: 600, volume: 0.35, binaural: { enabled: true, differenceHz: 10 } },
      { frequencyHz: 200, waveform: 'sine', durationSeconds: 300, volume: 0.35, binaural: { enabled: true, differenceHz: 12 } },
      { frequencyHz: 200, waveform: 'sine', durationSeconds: 300, volume: 0.3, binaural: { enabled: true, differenceHz: 10 } },
    ],
  },
];

export function getProtocolById(id: string): Protocol | undefined {
  return PROTOCOLS.find((p) => p.id === id);
}

export function getProtocolsByDomain(domain: string): Protocol[] {
  return PROTOCOLS.filter((p) => p.domain.includes(domain as 'cuerpo' | 'alma' | 'espiritu'));
}
