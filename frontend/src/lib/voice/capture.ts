export interface VoiceBlob { blob: Blob; durationMs: number; kind: 'intention' | 'marker' | 'reflection' }
export const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
export const AUDIO_MIMES = ['audio/webm', 'audio/ogg', 'audio/mp4'];
export function validateVoiceBlob(input: VoiceBlob) {
  const maxMs = input.kind === 'intention' ? 60000 : 30000;
  if (!['intention', 'marker', 'reflection'].includes(input.kind) || !AUDIO_MIMES.includes(input.blob.type.split(';')[0]) || input.blob.size === 0 || input.blob.size > MAX_AUDIO_BYTES || !Number.isFinite(input.durationMs) || input.durationMs <= 0 || input.durationMs > maxMs) throw new Error('Audio no admitido: revisa formato, tamaño o duración.');
}
const aborted = () => new DOMException('Captura cancelada', 'AbortError');
export class VoiceCaptureController {
  private generation = 0;
  private busy = false;
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private reject: ((reason: Error) => void) | null = null;
  private chunks: Blob[] = [];
  private unbind = () => {};
  private stopTracks() { this.stream?.getTracks().forEach(track => track.stop()); this.stream = null; }
  private cleanup() {
    if (this.timer) clearTimeout(this.timer); this.timer = null; this.stopTracks(); this.unbind(); this.unbind = () => {};
    if (this.recorder) { this.recorder.ondataavailable = null; this.recorder.onstop = null; this.recorder.onerror = null; }
    this.recorder = null; this.chunks = []; this.reject = null; this.busy = false;
  }
  async capture(kind: VoiceBlob['kind'], signal: AbortSignal, onListening: () => void): Promise<VoiceBlob> {
    if (this.busy) throw new Error('Ya hay una captura activa.');
    if (signal.aborted) throw aborted();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Este navegador no permite grabar. Usa la entrada de texto.');
    const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mime) throw new Error('Formato de grabación no compatible. Usa texto.');
    this.busy = true; const run = ++this.generation;
    const onAbort = () => this.cancel(); signal.addEventListener('abort', onAbort, { once: true }); this.unbind = () => signal.removeEventListener('abort', onAbort);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
      if (run !== this.generation || signal.aborted) { stream.getTracks().forEach(t => t.stop()); throw aborted(); }
      this.stream = stream;
      const recorder = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 64000 }); this.recorder = recorder;
      const start = performance.now(), limit = kind === 'intention' ? 60000 : 30000;
      return await new Promise<VoiceBlob>((resolve, reject) => {
        this.reject = reject; let bytes = 0; let stoppedAt: number | null = null;
        recorder.ondataavailable = event => {
          if (run !== this.generation) return;
          bytes += event.data.size;
          if (bytes > MAX_AUDIO_BYTES) { this.cancel(new Error('La captura supera 3 MB. Usa una frase más corta.')); return; }
          this.chunks.push(event.data);
        };
        recorder.onerror = () => this.cancel(new Error('No se pudo grabar. El micrófono puede estar ocupado; usa texto.'));
        recorder.onstop = () => {
          if (run !== this.generation) return;
          const result = { blob: new Blob(this.chunks, { type: mime }), durationMs: Math.min(limit, (stoppedAt ?? performance.now()) - start), kind };
          this.cleanup();
          try { validateVoiceBlob(result); resolve(result); } catch (e) { reject(e); }
        };
        // stop() stops hardware immediately; metadata uses the monotonic capture clock.
        this.endRecording = () => { stoppedAt = performance.now(); this.stopTracks(); if (recorder.state !== 'inactive') recorder.stop(); };
        recorder.start(250); onListening();
        this.timer = setTimeout(() => this.stop(), limit);
      });
    } catch (e) { if (run === this.generation) this.cleanup(); throw e; }
  }
  private endRecording: (() => void) | null = null;
  stop() { if (this.recorder) this.endRecording?.(); else this.cancel(); }
  cancel(reason: Error = aborted()) {
    ++this.generation; const reject = this.reject, recorder = this.recorder;
    this.stopTracks(); if (recorder) { recorder.onstop = null; recorder.ondataavailable = null; recorder.onerror = null; if (recorder.state !== 'inactive') recorder.stop(); }
    this.cleanup(); this.endRecording = null; reject?.(reason);
  }
}
