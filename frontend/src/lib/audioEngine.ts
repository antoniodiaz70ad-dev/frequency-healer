import { Waveform, OutputMode } from './types';

/**
 * Motor de Audio basado en Web Audio API.
 * Genera tonos, binaural beats, y maneja protocolos de frecuencias.
 */

class AudioEngine {
  private ctx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private oscillatorR: OscillatorNode | null = null; // binaural right channel
  private gainNode: GainNode | null = null;
  private gainNodeR: GainNode | null = null;
  private pannerL: StereoPannerNode | null = null;
  private pannerR: StereoPannerNode | null = null;
  private analyser: AnalyserNode | null = null;
  private isPlaying = false;
  private outputMode: OutputMode = 'speakers';
  private protocolTimer: ReturnType<typeof setTimeout> | null = null;
  private protocolAbort = false;

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /** Start a single tone */
  play(
    frequency: number,
    waveform: Waveform = 'sine',
    volume: number = 0.5,
    binaural?: { enabled: boolean; differenceHz: number }
  ) {
    this.stop();
    const ctx = this.getContext();

    // Create analyser for visualization
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;

    if (binaural?.enabled && binaural.differenceHz > 0) {
      // ── Binaural mode ──
      const freqL = frequency;
      const freqR = frequency + binaural.differenceHz;

      // Left oscillator → left pan
      this.oscillator = ctx.createOscillator();
      this.oscillator.type = waveform;
      this.oscillator.frequency.setValueAtTime(freqL, ctx.currentTime);

      this.gainNode = ctx.createGain();
      this.gainNode.gain.setValueAtTime(volume, ctx.currentTime);

      this.pannerL = ctx.createStereoPanner();
      this.pannerL.pan.setValueAtTime(-1, ctx.currentTime);

      this.oscillator.connect(this.gainNode);
      this.gainNode.connect(this.pannerL);
      this.pannerL.connect(this.analyser);
      this.analyser.connect(ctx.destination);

      // Right oscillator → right pan
      this.oscillatorR = ctx.createOscillator();
      this.oscillatorR.type = waveform;
      this.oscillatorR.frequency.setValueAtTime(freqR, ctx.currentTime);

      this.gainNodeR = ctx.createGain();
      this.gainNodeR.gain.setValueAtTime(volume, ctx.currentTime);

      this.pannerR = ctx.createStereoPanner();
      this.pannerR.pan.setValueAtTime(1, ctx.currentTime);

      this.oscillatorR.connect(this.gainNodeR);
      this.gainNodeR.connect(this.pannerR);
      this.pannerR.connect(ctx.destination);

      this.oscillator.start();
      this.oscillatorR.start();
    } else {
      // ── Mono mode ──
      this.oscillator = ctx.createOscillator();
      this.oscillator.type = waveform;
      this.oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

      this.gainNode = ctx.createGain();
      const adjustedVolume = this.outputMode === 'coils' ? Math.min(volume, 0.8) : volume;
      this.gainNode.gain.setValueAtTime(adjustedVolume, ctx.currentTime);

      this.oscillator.connect(this.gainNode);
      this.gainNode.connect(this.analyser);
      this.analyser.connect(ctx.destination);

      this.oscillator.start();
    }

    this.isPlaying = true;
  }

  /** Stop all audio */
  stop() {
    try {
      this.oscillator?.stop();
    } catch {}
    try {
      this.oscillatorR?.stop();
    } catch {}

    this.oscillator?.disconnect();
    this.oscillatorR?.disconnect();
    this.gainNode?.disconnect();
    this.gainNodeR?.disconnect();
    this.pannerL?.disconnect();
    this.pannerR?.disconnect();
    this.analyser?.disconnect();

    this.oscillator = null;
    this.oscillatorR = null;
    this.gainNode = null;
    this.gainNodeR = null;
    this.pannerL = null;
    this.pannerR = null;
    this.analyser = null;
    this.isPlaying = false;
  }

  /** Change frequency while playing */
  setFrequency(frequency: number) {
    if (this.oscillator && this.ctx) {
      this.oscillator.frequency.setValueAtTime(frequency, this.ctx.currentTime);
    }
  }

  /** Change volume while playing */
  setVolume(volume: number) {
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
    }
    if (this.gainNodeR && this.ctx) {
      this.gainNodeR.gain.setValueAtTime(volume, this.ctx.currentTime);
    }
  }

  /** Set output mode */
  setOutputMode(mode: OutputMode) {
    this.outputMode = mode;
  }

  /** Get playing state */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /** Get analyser data for visualization */
  getAnalyserData(): Float32Array | null {
    if (!this.analyser) return null;
    const data = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(data);
    return data;
  }

  /** Get frequency data for spectrum visualization */
  getFrequencyData(): Uint8Array | null {
    if (!this.analyser) return null;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  /** Play a protocol (sequence of frequencies) */
  async playProtocol(
    steps: Array<{
      frequencyHz: number;
      waveform: Waveform;
      durationSeconds: number;
      volume: number;
      binaural?: { enabled: boolean; differenceHz: number };
    }>,
    onStepChange?: (stepIndex: number) => void,
    onComplete?: () => void
  ) {
    this.protocolAbort = false;

    for (let i = 0; i < steps.length; i++) {
      if (this.protocolAbort) break;

      const step = steps[i];
      onStepChange?.(i);

      this.play(
        step.frequencyHz,
        step.waveform,
        step.volume,
        step.binaural
      );

      await new Promise<void>((resolve) => {
        this.protocolTimer = setTimeout(resolve, step.durationSeconds * 1000);
      });
    }

    this.stop();
    onComplete?.();
  }

  /** Stop protocol */
  stopProtocol() {
    this.protocolAbort = true;
    if (this.protocolTimer) {
      clearTimeout(this.protocolTimer);
      this.protocolTimer = null;
    }
    this.stop();
  }

  /** Convert frequency to 432 Hz tuning */
  static to432(frequency: number): number {
    // Standard: A4 = 440 Hz. 432 tuning: A4 = 432 Hz
    // Ratio: 432/440 = 0.981818...
    return frequency * (432 / 440);
  }

  /** Cleanup */
  destroy() {
    this.stopProtocol();
    this.stop();
    this.ctx?.close();
    this.ctx = null;
  }
}

// Singleton
let engine: AudioEngine | null = null;

export function getAudioEngine(): AudioEngine {
  if (!engine) {
    engine = new AudioEngine();
  }
  return engine;
}

export { AudioEngine };
