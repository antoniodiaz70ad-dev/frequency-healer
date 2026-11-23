import { acquirePlaybackSession } from '../marina/backgroundPlayback';
import { crystalTimeline, validatePreparation, type CrystalPreparation } from './model';

function browserContext(): AudioContext {
  const browser = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  const Constructor = browser.AudioContext ?? browser.webkitAudioContext;
  if (!Constructor) throw new Error('Este navegador no ofrece el motor de audio de la sesión.');
  return new Constructor();
}
/** The whole finite score is scheduled on AudioContext time, including the silent tail. */
export class CrystalAudio {
  private context: AudioContext | null = null;
  private sources: OscillatorNode[] = [];
  private nodes: AudioNode[] = [];
  private master: GainNode | null = null;
  private generation = 0;
  private offsetMs = 0;
  private startedAt = 0;
  private endsAt = 0;
  private durationMs = 0;
  private releasePlayback = () => {};
  constructor(private readonly factory = browserContext, private readonly stopExternal = () => {}, private readonly onInterrupted = () => {}) {}
  async play(preparation: CrystalPreparation, volume: number, elapsedMs = 0) {
    this.stop(); validatePreparation(preparation, true);
    const level = this.level(volume), durationMs = preparation.duration * 60000;
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs >= durationMs) throw new Error('El punto de reanudación no es válido.');
    this.offsetMs = elapsedMs;
    const steps = crystalTimeline(preparation);
    this.stopExternal();
    const ticket = this.generation;
    this.releasePlayback = acquirePlaybackSession();
    try {
      const ctx = this.context ?? (this.context = this.factory());
      if (steps.some(s => s.tones.some(t => t.hz >= ctx.sampleRate / 2))) throw new Error('La frecuencia supera lo que el dispositivo puede representar.');
      ctx.onstatechange = () => {
        if (ctx.state !== 'running' && this.master) { this.stop(); this.onInterrupted(); }
      };
      if (ctx.state !== 'running') await ctx.resume();
      if (ticket !== this.generation) return false;
      if (ctx.state !== 'running') throw new Error('El dispositivo pausó el audio. Toca Reanudar para continuar.');
      const now = ctx.currentTime;
      this.startedAt = now; this.durationMs = durationMs; this.endsAt = now + (durationMs - elapsedMs) / 1000;
      const master = ctx.createGain(); this.master = master; this.nodes.push(master);
      master.gain.setValueAtTime(level, now); master.gain.setValueAtTime(0, this.endsAt);
      master.connect(ctx.destination);
      let boundary = 0;
      for (const step of steps) {
        const startSeconds = boundary; boundary += step.seconds;
        if (boundary <= elapsedMs / 1000) continue;
        const start = now + Math.max(0, startSeconds - elapsedMs / 1000), end = now + boundary - elapsedMs / 1000;
        const fade = Math.min(.25, (end - start) / 2);
        for (const tone of step.tones) {
          const source = ctx.createOscillator(), gain = ctx.createGain();
          source.type = 'sine'; source.frequency.setValueAtTime(tone.hz, start);
          gain.gain.setValueAtTime(0, now); gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(tone.level, start + fade);
          gain.gain.setValueAtTime(tone.level, end - fade); gain.gain.linearRampToValueAtTime(0, end);
          source.connect(gain); gain.connect(master);
          this.nodes.push(source, gain); this.sources.push(source);
          source.start(start); source.stop(end + .01);
        }
      }
      return true;
    } catch (error) { if (ticket === this.generation) this.stop(); throw error; }
  }
  elapsedMs() {
    if (!this.context || !this.master) return this.offsetMs;
    return Math.min(this.durationMs, this.offsetMs + Math.max(0, this.context.currentTime - this.startedAt) * 1000);
  }
  setVolume(volume: number) {
    const level = this.level(volume), ctx = this.context, master = this.master;
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    master.gain.cancelAndHoldAtTime(now);
    if (now < this.endsAt) master.gain.linearRampToValueAtTime(level, Math.min(now + .05, this.endsAt));
    master.gain.setValueAtTime(0, Math.max(now, this.endsAt));
  }
  private level(v: number) {
    if (!Number.isFinite(v)) throw new Error('El volumen no es válido.');
    return Math.max(0, Math.min(.6, v));
  }
  stop() {
    this.generation++;
    this.releasePlayback(); this.releasePlayback = () => {};
    const ctx = this.context, master = this.master, sources = this.sources, nodes = this.nodes;
    if (master) this.offsetMs = this.elapsedMs();
    this.master = null; this.sources = []; this.nodes = [];
    const now = ctx?.currentTime ?? 0;
    if (master) { master.gain.cancelAndHoldAtTime(now); master.gain.linearRampToValueAtTime(0, now + .03); }
    for (const source of sources) { try { source.stop(now + .035); } catch {} }
    if (nodes.length) setTimeout(() => { for (const node of nodes) { try { node.disconnect(); } catch {} } }, 45);
  }
  dispose() {
    this.stop(); const ctx = this.context; this.context = null;
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => {});
  }
}
