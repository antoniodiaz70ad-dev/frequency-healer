import { validateVoiceBlob, type VoiceBlob } from './capture';
import { text } from './validation';
export interface TranscriptResult { text: string; source: 'remote' | 'manual' }
export interface TranscriptionProvider { transcribe(input: VoiceBlob, signal: AbortSignal): Promise<TranscriptResult> }
export class ServerTranscriptionProvider implements TranscriptionProvider {
  async transcribe(input: VoiceBlob, signal: AbortSignal): Promise<TranscriptResult> {
    validateVoiceBlob(input); signal.throwIfAborted();
    const body = new FormData(); body.append('audio', input.blob, 'capture'); body.append('kind', input.kind); body.append('durationMs', String(input.durationMs));
    const response = await fetch('/api/voice/transcribe', { method: 'POST', body, signal });
    if (!response.ok) throw new Error(response.status === 503 ? 'Transcripción no configurada. Escribe tus palabras para continuar.' : 'No se pudo transcribir. Escribe tus palabras para continuar.');
    const result = await response.json(); signal.throwIfAborted();
    return { text: text(result.text), source: 'remote' };
  }
}
