import { compositionMix, validateComposition, type ComposerRecipe } from './composer';
import { acquirePlaybackSession } from './backgroundPlayback';

function createContext(): AudioContext {
  const browser = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  const Constructor = browser.AudioContext ?? browser.webkitAudioContext;
  if (!Constructor) throw new Error('Este navegador no ofrece el motor de audio.');
  return new Constructor();
}

/** Independent, bounded layer mixer. LFO outputs drive gain only. */
export class MarinaComposerAudio {
  private context: AudioContext | null = null;
  private nodes: AudioNode[] = [];
  private sources: OscillatorNode[] = [];
  private master: GainNode | null = null;
  private generation = 0;
  private endsAt = 0;
  private transition = .05;
  private offsetMs = 0;
  private startedAt = 0;
  private durationMs = 0;
  private releasePlayback = () => {};
  constructor(private readonly factory = createContext, private readonly stopExternal = () => {}, private readonly onInterrupted = () => {}) {}

  async play(recipe: ComposerRecipe, volume: number, elapsedMs = 0): Promise<boolean> {
    this.stop();
    validateComposition(recipe);
    const level = this.level(volume);
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs >= recipe.durationMinutes * 60000) throw new Error('La composición ya terminó o tiene un tiempo inválido.');
    this.offsetMs = elapsedMs;
    const layers = compositionMix(recipe);
    if (!layers.length) throw new Error('Activa al menos una capa con volumen mayor que cero.');
    this.stopExternal();
    const ticket = this.generation;
    this.releasePlayback = acquirePlaybackSession();
    try {
      const ctx = this.context ?? (this.context = this.factory());
      validateComposition(recipe, ctx.sampleRate);
      ctx.onstatechange = () => {
        if (ctx.state !== 'running' && this.nodes.length) { this.stop(); this.onInterrupted(); }
      };
      if (ctx.state !== 'running') await ctx.resume();
      if (ticket !== this.generation) return false;
      if (ctx.state !== 'running') throw new Error('El navegador pausó el audio. Toca Reanudar para continuar.');
      const now = ctx.currentTime, remaining = recipe.durationMinutes * 60 - elapsedMs / 1000;
      const fade = Math.min(recipe.transitionSeconds, remaining / 2);
      const master = ctx.createGain();
      this.master = master; this.nodes.push(master);
      this.offsetMs = elapsedMs; this.startedAt = now;
      this.durationMs = recipe.durationMinutes * 60000;
      this.endsAt = now + remaining; this.transition = fade;
      master.gain.setValueAtTime(0, now);
      master.gain.linearRampToValueAtTime(level, now + fade);
      master.gain.setValueAtTime(level, this.endsAt - fade);
      master.gain.linearRampToValueAtTime(0, this.endsAt);
      master.connect(ctx.destination);
      const oscillator = (hz: number) => {
        const node = ctx.createOscillator(); node.type = 'sine';
        node.frequency.setValueAtTime(hz, now);
        this.nodes.push(node); this.sources.push(node); return node;
      };
      for (const layer of layers) {
        const gain = ctx.createGain(); gain.gain.setValueAtTime(layer.gain, now);
        gain.connect(master); this.nodes.push(gain);
        if (layer.mode === 'binaural') {
          const merger = ctx.createChannelMerger(2); this.nodes.push(merger);
          oscillator(layer.carrierHz).connect(merger, 0, 0);
          oscillator(layer.carrierHz + layer.rateHz).connect(merger, 0, 1);
          merger.connect(gain);
        } else if (layer.mode === 'pulse') {
          const envelope = ctx.createGain(), depth = ctx.createGain();
          this.nodes.push(envelope, depth);
          // A(t) = 1 - depth/2 + (depth/2) sin(2π f t), always in [0, 1].
          envelope.gain.setValueAtTime(1 - layer.depth / 2, now);
          depth.gain.setValueAtTime(layer.depth / 2, now);
          oscillator(layer.rateHz).connect(depth); depth.connect(envelope.gain);
          oscillator(layer.carrierHz).connect(envelope); envelope.connect(gain);
        } else oscillator(layer.carrierHz).connect(gain);
      }
      for (const source of this.sources) { source.start(now); source.stop(this.endsAt + .01); }
      return true;
    } catch (error) { if (ticket === this.generation) this.stop(); throw error; }
  }
  /** Audio-context time excludes suspension and stays aligned with rendered audio. */
  elapsedMs() {
    if (!this.context || !this.master) return this.offsetMs;
    if (this.context.currentTime >= this.endsAt) return this.durationMs;
    return this.offsetMs + Math.max(0, Math.min(this.endsAt, this.context.currentTime) - this.startedAt) * 1000;
  }
  setVolume(volume: number) {
    const level = this.level(volume), ctx = this.context, master = this.master;
    if (!ctx || !master) return;
    const now = ctx.currentTime, fadeStart = this.endsAt - this.transition;
    master.gain.cancelAndHoldAtTime(now);
    if (now < fadeStart) {
      const targetAt = Math.min(now + .05, fadeStart);
      master.gain.linearRampToValueAtTime(level, targetAt);
      master.gain.setValueAtTime(level, fadeStart);
    }
    master.gain.linearRampToValueAtTime(0, Math.max(now, this.endsAt));
  }
  private level(volume: number) {
    if (!Number.isFinite(volume)) throw new Error('El volumen no es válido.');
    return Math.max(0, Math.min(.6, volume));
  }
  stop() {
    this.generation++;
    this.releasePlayback(); this.releasePlayback = () => {};
    const ctx = this.context, sources = this.sources, nodes = this.nodes, master = this.master;
    if (ctx && master) this.offsetMs = this.elapsedMs();
    this.sources = []; this.nodes = []; this.master = null;
    const now = ctx?.currentTime ?? 0;
    if (master) {
      master.gain.cancelAndHoldAtTime(now);
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
