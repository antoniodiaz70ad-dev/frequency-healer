import { buildSchedule, masterGain, voiceGain, type HarmonicConfig, type HarmonicSchedule } from './math';

/** Isolated audio graph; never shares the legacy singleton or its visualizer. */
export class HarmonicEngine {
  private generation = 0;
  private context: AudioContext | null = null;
  private bus: GainNode | null = null;
  private nodes: Array<{ osc: OscillatorNode; gain: GainNode }> = [];
  private origin = 0;
  private schedule: HarmonicSchedule | null = null;
  private volume = 20;
  private factor = 1;
  private active = false;
  private waits = new Map<ReturnType<typeof setTimeout>, () => void>();
  constructor(private createContext: () => AudioContext = () => new AudioContext()) {}

  async start(config: HarmonicConfig, onComplete: () => void = () => {}) {
    const schedule = buildSchedule(config); // Recompute, never trust supplied frequencies.
    this.stop();
    const run = ++this.generation;
    const ctx = this.createContext();
    this.context = ctx;
    try {
      await ctx.resume();
      if (run !== this.generation) return false;
      this.volume = config.uiVolume; this.factor = 1;
      this.bus = ctx.createGain();
      this.bus.gain.setValueAtTime(masterGain(this.volume), ctx.currentTime);
      this.bus.connect(ctx.destination);
      this.origin = ctx.currentTime + 0.01;
      this.schedule = schedule; this.active = true;
      let remaining = schedule.steps.reduce((n, step) => n + step.frequencies.length, 0);
      for (const step of schedule.steps) {
        for (const hz of step.frequencies) {
          const osc = ctx.createOscillator(); const gain = ctx.createGain();
          const start = this.origin + step.offsetSeconds, end = start + step.durationSeconds;
          osc.type = 'sine'; osc.frequency.setValueAtTime(hz, start);
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(voiceGain(step.frequencies.length), start + 0.03);
          gain.gain.setValueAtTime(voiceGain(step.frequencies.length), end - 0.03);
          gain.gain.linearRampToValueAtTime(0, end);
          osc.connect(gain); gain.connect(this.bus);
          this.nodes.push({ osc, gain });
          osc.onended = () => {
            osc.disconnect(); gain.disconnect();
            if (run === this.generation) this.nodes = this.nodes.filter(node => node.osc !== osc);
            if (--remaining === 0 && run === this.generation) { this.stop(); onComplete(); }
          };
          osc.start(start); osc.stop(end);
        }
      }
      return true;
    } catch {
      if (run === this.generation) this.stop();
      throw new Error('No se pudo iniciar el audio. Confirma de nuevo o usa otro navegador.');
    }
  }
  elapsedMs() { return this.context && this.schedule ? Math.min(this.schedule.durationSeconds * 1000, Math.max(0, (this.context.currentTime - this.origin) * 1000)) : 0; }
  snapshot() {
    const seconds = this.elapsedMs() / 1000;
    const index = this.schedule?.steps.findIndex(s => seconds >= s.offsetSeconds && seconds < s.offsetSeconds + s.durationSeconds) ?? -1;
    return { stepIndex: index < 0 ? null : index, activeHz: index < 0 ? [] : [...this.schedule!.steps[index].frequencies] };
  }
  isPlaying() { return this.active; }
  getVolume() { return this.volume; }
  setVolume(volume: number) { masterGain(volume); this.volume = volume; this.ramp(0.03); }
  private ramp(seconds: number) {
    if (!this.active || !this.context || !this.bus) return;
    const param = this.bus.gain, now = this.context.currentTime;
    param.cancelAndHoldAtTime(now);
    param.linearRampToValueAtTime(masterGain(this.volume) * this.factor, now + seconds);
  }
  async duck() {
    if (!this.active) return false;
    const run = this.generation; this.factor = 0.25; this.ramp(0.15);
    await new Promise<void>(resolve => { const timer = setTimeout(() => { this.waits.delete(timer); resolve(); }, 150); this.waits.set(timer, resolve); });
    return this.active && run === this.generation;
  }
  restore() { if (this.active) { this.factor = 1; this.ramp(0.3); } }
  stop() {
    ++this.generation; this.active = false;
    for (const [timer, resolve] of this.waits) { clearTimeout(timer); resolve(); } this.waits.clear();
    const ctx = this.context, nodes = this.nodes, bus = this.bus;
    this.context = null; this.nodes = []; this.bus = null; this.schedule = null;
    if (!ctx) return;
    const close = () => { bus?.disconnect(); if (ctx.state !== 'closed') void ctx.close().catch(() => {}); };
    if (!nodes.length || ctx.state !== 'running') {
      for (const { osc, gain } of nodes) { osc.onended = null; try { osc.stop(); } catch {} osc.disconnect(); gain.disconnect(); }
      close(); return;
    }
    const end = ctx.currentTime + 0.03;
    bus?.gain.cancelAndHoldAtTime(ctx.currentTime); bus?.gain.linearRampToValueAtTime(0, end);
    let remaining = nodes.length;
    for (const { osc, gain } of nodes) {
      osc.onended = () => { osc.disconnect(); gain.disconnect(); if (--remaining === 0) close(); };
      try { osc.stop(end); } catch { osc.disconnect(); gain.disconnect(); if (--remaining === 0) close(); }
    }
  }
  dispose() { this.stop(); }
}
