import { exportFormat, type ExportScore } from './score';
import { mixDivisor, renderPcmChunk, type VoicePcm } from './pcm';

// Handshake limits in-flight memory to one second; main thread can cancel immediately.
const port = self as unknown as { onmessage: ((event: MessageEvent) => void) | null; postMessage: (value: unknown, transfer?: Transferable[]) => void };
let score: ExportScore, voices: VoicePcm[], sampleRate = 0, frames = 0, first = 0, divisor = 1;
port.onmessage = (event: MessageEvent) => {
  try {
    if (event.data.type === 'start') {
      score = event.data.score; voices = event.data.voices;
      ({ sampleRate, frames } = exportFormat(score)); divisor = mixDivisor(score, voices); first = 0;
    }
    if (first >= frames) { port.postMessage({ type: 'done', divisor }); return; }
    const count = Math.min(sampleRate, frames - first), buffer = renderPcmChunk(score, sampleRate, first, count, voices, divisor);
    first += count; port.postMessage({ type: 'chunk', buffer, progress: first / frames }, [buffer]);
  } catch (error) { port.postMessage({ type: 'error', message: (error as Error).message }); }
};
