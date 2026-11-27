import { arthurGuide } from '../narration/manifest';
import { exportFormat, type ExportScore } from './score';
import { wavHeader, type VoicePcm } from './pcm';

export async function prepareDownload(score: ExportScore, signal: AbortSignal, progress: (value: number) => void) {
  const format = exportFormat(score), voices: VoicePcm[] = [];
  signal.throwIfAborted();
  if (score.voice.cues.length) {
    // Decode only short, existing recordings. Never render a session-sized float buffer.
    const ctx = new OfflineAudioContext(2, 1, format.sampleRate);
    for (const cue of score.voice.cues) {
      const src = arthurGuide(cue.key)?.src;
      if (!src) throw new Error('Falta una grabación de Arthur. No se preparó un archivo incompleto.');
      let response: Response;
      try { response = await fetch(src, { signal, cache: 'force-cache', credentials: 'same-origin' }); }
      catch (error) { if (signal.aborted) throw error; throw new Error('No se pudo cargar Arthur. Reintenta la descarga con conexión.'); }
      if (!response.ok) throw new Error('No se pudo cargar Arthur. Reintenta la descarga con conexión.');
      const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
      signal.throwIfAborted();
      voices.push({ key: cue.key, at: cue.atMs / 1000, seconds: Math.min(buffer.duration, (cue.endMs - cue.atMs) / 1000), sampleRate: buffer.sampleRate,
        channels: Array.from({ length: Math.min(2, buffer.numberOfChannels) }, (_, channel) => new Float32Array(buffer.getChannelData(channel))) });
    }
  }
  signal.throwIfAborted();
  const worker = new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module' });
  const chunks: BlobPart[] = [wavHeader(format.frames, format.sampleRate)];
  return new Promise<{ audio: Blob; metadata: Blob; title: string; filename: string }>((resolve, reject) => {
    const cleanup = () => { worker.terminate(); signal.removeEventListener('abort', cancel); };
    const cancel = () => { cleanup(); reject(new DOMException('Descarga cancelada', 'AbortError')); };
    signal.addEventListener('abort', cancel, { once: true });
    worker.onerror = () => { cleanup(); reject(new Error('No se pudo preparar el archivo en este navegador. Reduce la duración y reintenta.')); };
    worker.onmessage = event => {
      const data = event.data;
      if (data.type === 'error') { cleanup(); reject(new Error(data.message)); }
      else if (data.type === 'chunk') {
        chunks.push(data.buffer); progress(data.progress); worker.postMessage({ type: 'next' });
      } else if (data.type === 'done') {
        cleanup();
        const id = crypto.randomUUID(), createdAt = new Date().toISOString();
        const metadata = { exportId: id, createdAt, ...score, format: { encoding: 'PCM signed 16-bit little-endian', channels: 2, ...format },
          mixDivisor: data.divisor, includedRecordings: voices.map(({ key, at, seconds }) => ({ key, at, seconds })),
          scope: 'Full configuration from zero at fixed volumes; no live manual changes, device speech, personal recording, visuals or practice log. Configuration file is informational, not a journal import.' };
        resolve({ audio: new Blob(chunks, { type: 'audio/wav' }), metadata: new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' }), title: score.title, filename: `resonance-${id}` });
      }
    };
    const transfer = voices.flatMap(v => v.channels.map(c => c.buffer));
    worker.postMessage({ type: 'start', score, voices }, transfer);
  });
}
