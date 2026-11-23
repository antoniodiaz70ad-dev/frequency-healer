import { arthurGuide } from './manifest';

export type GuideCue = { key: string; atMs: number; endMs: number };
export type GuideTimeline = { cues: GuideCue[]; volume: number };
const cache = new WeakMap<AudioContext, Map<string, AudioBuffer>>();
const level = (value: number) => {
  if (!Number.isFinite(value)) throw new Error('El volumen de voz no es válido.');
  return Math.max(0, Math.min(1, value));
};
export function guideCues(phases: readonly { id: string; seconds: number }[], family: 'crystals' | 'marina', omit: readonly string[] = []): GuideCue[] {
  let atMs = 0;
  return phases.flatMap(phase => {
    const cue = { key: `${family}-${phase.id}`, atMs, endMs: atMs + phase.seconds * 1000 };
    atMs = cue.endMs;
    return arthurGuide(cue.key)?.src && !omit.includes(phase.id) ? [cue] : [];
  });
}

/** Schedules cached recordings on the SAME native clock as the tone timeline. */
export class ArthurNarration {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private nodes: AudioNode[] = [];
  private sources: AudioBufferSourceNode[] = [];
  constructor(private readonly fetcher: typeof fetch = (...args) => fetch(...args)) {}
  async prepare(ctx: AudioContext, timeline: GuideTimeline, signal: AbortSignal) {
    level(timeline.volume);
    let buffers = cache.get(ctx);
    if (!buffers) { buffers = new Map(); cache.set(ctx, buffers); }
    const result = new Map<string, AudioBuffer>();
    for (const cue of timeline.cues) {
      const guide = arthurGuide(cue.key);
      if (!guide?.src || !Number.isFinite(cue.atMs) || !Number.isFinite(cue.endMs) || cue.atMs < 0 || cue.endMs <= cue.atMs) throw new Error('La guía de Arthur no está disponible para esta fase.');
      if (signal.aborted) throw new Error('Preparación de voz cancelada.');
      let buffer = buffers.get(cue.key);
      if (!buffer) {
        const response = await this.fetcher(guide.src, { signal, cache: 'force-cache', credentials: 'same-origin' });
        if (!response.ok) throw new Error('No se pudo cargar Arthur. Reintenta o elige la voz del dispositivo.');
        buffer = await ctx.decodeAudioData(await response.arrayBuffer());
        if (signal.aborted) throw new Error('Preparación de voz cancelada.');
        buffers.set(cue.key, buffer);
      }
      result.set(cue.key, buffer);
    }
    return result;
  }
  schedule(ctx: AudioContext, timeline: GuideTimeline, buffers: Map<string, AudioBuffer>, elapsedMs: number, startsAt: number) {
    this.stop(); this.ctx = ctx;
    const gain = ctx.createGain(); gain.gain.setValueAtTime(level(timeline.volume), startsAt);
    gain.connect(ctx.destination); this.gain = gain; this.nodes.push(gain);
    for (const cue of timeline.cues) {
      const buffer = buffers.get(cue.key);
      if (!buffer) continue;
      const offset = Math.max(0, (elapsedMs - cue.atMs) / 1000);
      const duration = Math.min(buffer.duration - offset, (cue.endMs - Math.max(elapsedMs, cue.atMs)) / 1000);
      if (duration <= 0) continue;
      const at = startsAt + Math.max(0, (cue.atMs - elapsedMs) / 1000);
      const source = ctx.createBufferSource(), envelope = ctx.createGain();
      source.buffer = buffer; source.connect(envelope); envelope.connect(gain);
      const fade = Math.min(.02, duration / 2);
      envelope.gain.setValueAtTime(0, at); envelope.gain.linearRampToValueAtTime(1, at + fade);
      envelope.gain.setValueAtTime(1, at + duration - fade); envelope.gain.linearRampToValueAtTime(0, at + duration);
      source.start(at, offset, duration); this.sources.push(source); this.nodes.push(source, envelope);
    }
  }
  setVolume(value: number) {
    const volume = level(value);
    if (this.ctx && this.gain) this.gain.gain.setTargetAtTime(volume, this.ctx.currentTime, .025);
  }
  stop() {
    for (const source of this.sources) { try { source.stop(); } catch {} }
    for (const node of this.nodes) { try { node.disconnect(); } catch {} }
    this.sources = []; this.nodes = []; this.gain = null; this.ctx = null;
  }
}
