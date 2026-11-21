import { validateMarinaAudio, type MarinaAudioConfig } from './model';

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
  constructor(private readonly createContext: ContextFactory = browserContext, private readonly stopExternal: () => void = () => {}, private readonly onInterrupted: () => void = () => {}) {}
  async play(config: MarinaAudioConfig, volume: number): Promise<boolean> {
    this.stop();
    validateMarinaAudio(config);
    if (config.mode === 'silence') return true;
    this.stopExternal();
    const ticket = this.generation;
    const ctx = this.context ?? (this.context = this.createContext());
    ctx.onstatechange = () => {
      if (ctx.state !== 'running' && this.nodes.length) { this.stop(); this.onInterrupted(); }
    };
    validateMarinaAudio(config, ctx.sampleRate);
    if (ctx.state !== 'running') await ctx.resume();
    if (ticket !== this.generation) return false;
    if (ctx.state !== 'running') throw new Error('El navegador pausó el audio. Vuelve a tocar Reanudar.');
    try {
      const master = ctx.createGain();
      master.gain.setValueAtTime(0, ctx.currentTime);
      master.gain.linearRampToValueAtTime(this.level(volume), ctx.currentTime + .04);
      master.connect(ctx.destination);
      this.master = master;
      this.nodes.push(master);
      const osc = (hz: number) => {
        const node = ctx.createOscillator();
        node.type = 'sine';
        node.frequency.setValueAtTime(hz, ctx.currentTime);
        this.nodes.push(node); this.sources.push(node);
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
      for (const source of this.sources) source.start(ctx.currentTime);
      return true;
    } catch (error) { this.stop(); throw error; }
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
