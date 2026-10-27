export type Mode = 'observador' | 'decision' | 'diario';
export type State = 'idle' | 'requesting_permission' | 'connecting' | 'active' | 'paused' | 'ending' | 'ended' | 'error';
export type VoiceEvent = { type: 'speech_started' } | { type: 'transcript'; text: string; final: boolean } | { type: 'disconnected' };
/** No provider event names or model parameters are assumed by the domain. */
export interface VoiceAdapter {
  connect(stream: MediaStream | null, signal: AbortSignal, emit: (event: VoiceEvent) => void): Promise<void>;
  say(text: string): void;
  interrupt(): void;
  pause(paused: boolean): void;
  close(): void;
}
export type AnalysisLevel = 'standard' | 'pro';
export interface AnalysisAdapter {
  analyze(input: { context: string; level: AnalysisLevel; explicitlyConfirmed: boolean }, signal: AbortSignal): Promise<string>;
}
export interface Microphone { open(): Promise<MediaStream>; }
export interface Snapshot {
  state: State; mode: Mode; message: string; microphone: boolean;
  consent: 'none' | 'metrics' | 'summary'; summary: string; proPending: boolean;
}
export const introduction: Record<Mode, string> = {
  observador: 'Practica en un lugar seguro, sin conducir. Nota el apoyo del cuerpo y el entorno. Podemos dejar un minuto de silencio. Di continúa cuando quieras.',
  decision: 'Tú eliges. ¿Qué hecho concreto necesitas considerar para esta decisión?',
  diario: 'Puedes contar lo que quieras. No guardaremos tu relato. ¿Por dónde quieres empezar?',
};
export const facilitatorPolicy = 'Español de México, frases breves, una pregunta por turno. Separar hechos, interpretación, emoción autodeclarada, impulso, opciones, riesgos y acción elegida. No diagnosticar ni inferir emociones de la voz. No afirmar efectos metafísicos. No decidir ni ejecutar acciones externas. Silencio no es consentimiento. Terminar tiene prioridad. No cerrar los ojos conduciendo.';
