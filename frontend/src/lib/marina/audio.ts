import { validateMarinaAudio, type MarinaAudioConfig } from './model';
import { acquirePlaybackSession } from './backgroundPlayback';

export type MarinaAudioStep = { config: MarinaAudioConfig; seconds: number };

type ContextFactory = () => AudioContext;
function browserContext(): AudioContext {
  const browser = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  const Constructor = browser.AudioContext ?? browser.webkitAudioContext;
  if (!Constructor) throw new Error('Este navegador no ofrece el motor de audio. Puedes usar la guía en silencio.');
  return new Constructor();
}
/** Owns only this module's graph. Stop invalidates pending asynchronous starts. */
export class MarinaAudio {
  private context: AudioContext | null = null;
  private nodes: AudioNode[] = [];
  private sources: (OscillatorNode | ConstantSourceNode)[] = [];
  private master: GainNode | null = null;
  private generation = 0;
  private releasePlayback = () => {};
  constructor(private readonly createContext: ContextFactory = browserContext, private readonly stopExternal: () => void = () => {}, private readonly onInterrupted: () => void = () => {}) {}
  async play(config: MarinaAudioConfig, volume: number): Promise<boolean> {
    this.stop();
    validateMarinaAudio(config);
    if (config.mode === 'silence') return true;
    this.stopExternal();
    const ticket = this.generation;
    this.releasePlayback = acquirePlaybackSession();
    try {
      const ctx = this.context ?? (this.context = this.createContext());
      ctx.onstatechange = () => {
        if (ctx.state !== 'running' && this.nodes.length) { this.stop(); this.onInterrupted(); }
      };
      validateMarinaAudio(config, ctx.sampleRate);
      if (ctx.state !== 'running') await ctx.resume();
      if (ticket !== this.generation) return false;
      if (ctx.state !== 'running') throw new Error('El navegador pausó el audio. Vuelve a tocar Reanudar.');
      const master = ctx.createGain();
      master.gain.setValueAtTime(0, ctx.currentTime);
      master.gain.linearRampToValueAtTime(this.level(volume), ctx.currentTime + .04);
      master.connect(ctx.destination);
      this.master = master;
      this.nodes.push(master);
      this.schedule(config, ctx, master, ctx.currentTime);
      return true;
    } catch (error) { if (ticket === this.generation) this.stop(); throw error; }
  }
  /** Schedule every phase and its end on the audio clock before the UI can be throttled. */
  async playTimeline(steps: MarinaAudioStep[], volume: number, elapsedMs = 0): Promise<boolean> {
    this.stop();
    const level = this.level(volume);
    if (!steps.length || steps.some(step => !Number.isFinite(step.seconds) || step.seconds <= 0)) throw new Error('La secuencia sonora no tiene una duración válida.');
    const duration = steps.reduce((sum, step) => sum + step.seconds, 0);
    if (duration > 14400 || !Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs >= duration * 1000) throw new Error('La duración o el punto de reanudación no es válido.');
    steps.forEach(step => validateMarinaAudio(step.config));
    let boundary = 0;
    const remaining = steps.map(step => {
      const start = boundary; boundary += step.seconds;
      return { ...step, start: Math.max(0, start - elapsedMs / 1000), end: boundary - elapsedMs / 1000 };
    }).filter(step => step.end > 0 && step.config.mode !== 'silence');
    if (!remaining.length) return true;
    this.stopExternal();
    const ticket = this.generation;
    this.releasePlayback = acquirePlaybackSession();
    try {
      const ctx = this.context ?? (this.context = this.createContext());
      ctx.onstatechange = () => { if (ctx.state !== 'running' && this.nodes.length) { this.stop(); this.onInterrupted(); } };
      remaining.forEach(step => validateMarinaAudio(step.config, ctx.sampleRate));
      if (ctx.state !== 'running') await ctx.resume();
      if (ticket !== this.generation) return false;
      if (ctx.state !== 'running') throw new Error('El navegador pausó el audio. Vuelve a tocar Reanudar.');
      const now = ctx.currentTime, master = ctx.createGain();
      this.master = master; this.nodes.push(master);
      master.gain.setValueAtTime(level, now);
      master.gain.setValueAtTime(0, now + duration - elapsedMs / 1000);
      master.connect(ctx.destination);
      for (const step of remaining) {
        const start = now + step.start, end = now + step.end;
        const gain = ctx.createGain(), fade = Math.min(.04, (end - start) / 2);
        this.nodes.push(gain); gain.connect(master);
        gain.gain.setValueAtTime(0, now);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(1, start + fade);
        gain.gain.setValueAtTime(1, end - fade);
        gain.gain.linearRampToValueAtTime(0, end);
        this.schedule(step.config, ctx, gain, start, end);
      }
      return true;
    } catch (error) { if (ticket === this.generation) this.stop(); throw error; }
  }
  private schedule(config: MarinaAudioConfig, ctx: AudioContext, master: AudioNode, start: number, end?: number) {
    const sources: OscillatorNode[] = [];
    const osc = (hz: number) => {
      const node = ctx.createOscillator();
      node.type = 'sine';
      node.frequency.setValueAtTime(hz, start);
      this.nodes.push(node); this.sources.push(node);
      sources.push(node);
      return node;
    };
    if (config.mode === 'binaural') {
      const merger = ctx.createChannelMerger(2);
      const left = osc(config.carrierHz), right = osc(config.carrierHz + config.hz);
      left.connect(merger, 0, 0); right.connect(merger, 0, 1);
      merger.connect(master); this.nodes.push(merger);
    } else if (config.mode === 'pulse') {
      const carrier = osc(config.carrierHz), lfo = osc(config.hz);
      const envelope = ctx.createGain(), depth = ctx.createGain();
      envelope.gain.setValueAtTime(.5, ctx.currentTime);
      depth.gain.setValueAtTime(.5, ctx.currentTime);
      lfo.connect(depth); depth.connect(envelope.gain);
      carrier.connect(envelope); envelope.connect(master);
      this.nodes.push(envelope, depth);
    } else osc(config.hz).connect(master);
    for (const source of sources) { source.start(start); if (end !== undefined) source.stop(end + .01); }
  }
  setVolume(volume: number) {
    if (!this.context || !this.master) return;
    this.master.gain.setTargetAtTime(this.level(volume), this.context.currentTime, .025);
  }
  private level(volume: number) {
    if (!Number.isFinite(volume)) throw new Error('El volumen no es válido.');
    return Math.max(0, Math.min(1, volume));
  }
  stop() {
    this.generation++;
    this.releasePlayback(); this.releasePlayback = () => {};
    const ctx = this.context, sources = this.sources, nodes = this.nodes, master = this.master;
    this.sources = []; this.nodes = []; this.master = null;
    const now = ctx?.currentTime ?? 0;
    if (master) {
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + .03);
    }
    for (const source of sources) { try { source.stop(now + .035); } catch {} }
    if (nodes.length) setTimeout(() => { for (const node of nodes) { try { node.disconnect(); } catch {} } }, 45);
  }
  dispose() {
    this.stop();
    const ctx = this.context; this.context = null;
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => {});
  }
}
