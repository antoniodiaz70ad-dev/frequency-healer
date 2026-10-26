import type { AnalysisAdapter, VoiceAdapter, VoiceEvent } from './contracts';

/** Deterministic local simulator: no recognition, transmission, recording or billing. */
export class MockVoiceAdapter implements VoiceAdapter {
  private emit: ((event: VoiceEvent) => void) | null = null;
  private paused = false;
  readonly spoken: string[] = [];
  interruptions = 0;
  async connect(_stream: MediaStream | null, signal: AbortSignal, emit: (event: VoiceEvent) => void) {
    if (signal.aborted) throw new DOMException('Cancelado', 'AbortError');
    this.emit = emit;
  }
  say(text: string) { if (this.emit && !this.paused) this.spoken.push(text); }
  interrupt() { this.interruptions++; }
  pause(paused: boolean) { this.paused = paused; this.interrupt(); }
  close() { this.interrupt(); this.emit = null; this.spoken.length = 0; }
  simulate(event: VoiceEvent) { this.emit?.(event); }
}
export class MockAnalysisAdapter implements AnalysisAdapter {
  async analyze(input: Parameters<AnalysisAdapter['analyze']>[0], signal: AbortSignal) {
    if (signal.aborted) throw new DOMException('Cancelado', 'AbortError');
    if (input.level === 'pro' && !input.explicitlyConfirmed) throw new Error('Confirmación requerida');
    return 'Simulación de análisis: distingue hechos verificables de interpretación; identifica tu impulso y compara opciones y riesgos. La acción la eliges tú. ¿Qué información te falta?';
  }
}
