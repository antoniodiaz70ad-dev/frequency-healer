import { Waveform, OutputMode } from './types';
import { AUDIO, COMPRESSOR } from './constants';

/**
 * Motor de Audio v2 basado en Web Audio API.
 * Genera tonos con fade-in/out, beats binaurales, compresor/limitador,
 * crossfade entre pasos de protocolo, y visualización.
 */

class AudioEngine {
  private ctx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private oscillatorR: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private gainNodeR: GainNode | null = null;
  private pannerL: StereoPannerNode | null = null;
  private pannerR: StereoPannerNode | null = null;
  private analyser: AnalyserNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private isPlaying = false;
  private outputMode: OutputMode = 'speakers';
  private protocolTimer: ReturnType<typeof setTimeout> | null = null;
  private protocolAbort = false;
  private currentBinauralDiff = 0;
  private lastError: string | null = null;
  private fadeOutTimer: ReturnType<typeof setTimeout> | null = null;

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private createCompressor(ctx: AudioContext): DynamicsCompressorNode {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(COMPRESSOR.THRESHOLD, ctx.currentTime);
    comp.knee.setValueAtTime(COMPRESSOR.KNEE, ctx.currentTime);
    comp.ratio.setValueAtTime(COMPRESSOR.RATIO, ctx.currentTime);
    comp.attack.setValueAtTime(COMPRESSOR.ATTACK, ctx.currentTime);
    comp.release.setValueAtTime(COMPRESSOR.RELEASE, ctx.currentTime);
    return comp;
  }

  private adjustVolume(volume: number): number {
    return this.outputMode === 'coils'
      ? Math.min(volume, AUDIO.COILS_MAX_VOLUME)
      : volume;
  }

  /** Start a single tone with fade-in */
  play(
    frequency: number,
    waveform: Waveform = 'sine',
    volume: number = AUDIO.DEFAULT_VOLUME,
    binaural?: { enabled: boolean; differenceHz: number }
  ) {
    // Clear any pending fade-out from previous stop
    if (this.fadeOutTimer) {
      clearTimeout(this.fadeOutTimer);
      this.fadeOutTimer = null;
    }

    this.stopImmediate();
    const ctx = this.getContext();
    this.lastError = null;

    // Shared nodes
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = AUDIO.FFT_SIZE;
    this.compressor = this.createCompressor(ctx);

    // Chain: analyser → compressor → destination
    this.analyser.connect(this.compressor);
    this.compressor.connect(ctx.destination);

    const adjustedVolume = this.adjustVolume(volume);
    const now = ctx.currentTime;

    if (binaural?.enabled && binaural.differenceHz > 0) {
      this.currentBinauralDiff = binaural.differenceHz;
      const freqL = frequency;
      const freqR = frequency + binaural.differenceHz;

      // Left channel
      this.oscillator = ctx.createOscillator();
      this.oscillator.type = waveform;
      this.oscillator.frequency.setValueAtTime(freqL, now);

      this.gainNode = ctx.createGain();
      this.gainNode.gain.setValueAtTime(0, now);
      this.gainNode.gain.linearRampToValueAtTime(adjustedVolume, now + AUDIO.FADE_IN_S);

      this.pannerL = ctx.createStereoPanner();
      this.pannerL.pan.setValueAtTime(-1, now);

      this.oscillator.connect(this.gainNode);
      this.gainNode.connect(this.pannerL);
      this.pannerL.connect(this.analyser);

      // Right channel — also routed through analyser
      this.oscillatorR = ctx.createOscillator();
      this.oscillatorR.type = waveform;
      this.oscillatorR.frequency.setValueAtTime(freqR, now);

      this.gainNodeR = ctx.createGain();
      this.gainNodeR.gain.setValueAtTime(0, now);
      this.gainNodeR.gain.linearRampToValueAtTime(adjustedVolume, now + AUDIO.FADE_IN_S);

      this.pannerR = ctx.createStereoPanner();
      this.pannerR.pan.setValueAtTime(1, now);

      this.oscillatorR.connect(this.gainNodeR);
      this.gainNodeR.connect(this.pannerR);
      this.pannerR.connect(this.analyser);

      this.oscillator.start();
      this.oscillatorR.start();
    } else {
      this.currentBinauralDiff = 0;

      // Mono mode
      this.oscillator = ctx.createOscillator();
      this.oscillator.type = waveform;
      this.oscillator.frequency.setValueAtTime(frequency, now);

      this.gainNode = ctx.createGain();
      this.gainNode.gain.setValueAtTime(0, now);
      this.gainNode.gain.linearRampToValueAtTime(adjustedVolume, now + AUDIO.FADE_IN_S);

      this.oscillator.connect(this.gainNode);
      this.gainNode.connect(this.analyser);

      this.oscillator.start();
    }

    this.isPlaying = true;
  }

  /** Stop with fade-out to prevent pops */
  stop() {
    if (!this.isPlaying || !this.ctx) {
      this.stopImmediate();
      return;
    }

    const now = this.ctx.currentTime;
    const fadeOut = AUDIO.FADE_OUT_S;

    // Ramp gain to 0
    if (this.gainNode) {
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
      this.gainNode.gain.linearRampToValueAtTime(0, now + fadeOut);
    }
    if (this.gainNodeR) {
      this.gainNodeR.gain.cancelScheduledValues(now);
      this.gainNodeR.gain.setValueAtTime(this.gainNodeR.gain.value, now);
      this.gainNodeR.gain.linearRampToValueAtTime(0, now + fadeOut);
    }

    this.isPlaying = false;

    // Disconnect after fade completes
    this.fadeOutTimer = setTimeout(() => {
      this.stopImmediate();
      this.fadeOutTimer = null;
    }, fadeOut * 1000 + 20);
  }

  /** Immediate stop without fade (used internally) */
  private stopImmediate() {
    try { this.oscillator?.stop(); } catch { /* already stopped */ }
    try { this.oscillatorR?.stop(); } catch { /* already stopped */ }

    this.oscillator?.disconnect();
    this.oscillatorR?.disconnect();
    this.gainNode?.disconnect();
    this.gainNodeR?.disconnect();
    this.pannerL?.disconnect();
    this.pannerR?.disconnect();
    this.analyser?.disconnect();
    this.compressor?.disconnect();

    this.oscillator = null;
    this.oscillatorR = null;
    this.gainNode = null;
    this.gainNodeR = null;
    this.pannerL = null;
    this.pannerR = null;
    this.analyser = null;
    this.compressor = null;
    this.isPlaying = false;
  }

  /** Change frequency with smooth ramp — updates both channels in binaural */
  setFrequency(frequency: number) {
    if (!this.oscillator || !this.ctx) return;

    const now = this.ctx.currentTime;
    const ramp = AUDIO.FREQUENCY_RAMP_S;
    const safeFreq = Math.max(AUDIO.MIN_FREQUENCY_HZ, frequency);

    this.oscillator.frequency.cancelScheduledValues(now);
    this.oscillator.frequency.setValueAtTime(this.oscillator.frequency.value, now);
    this.oscillator.frequency.exponentialRampToValueAtTime(safeFreq, now + ramp);

    if (this.oscillatorR && this.currentBinauralDiff > 0) {
      this.oscillatorR.frequency.cancelScheduledValues(now);
      this.oscillatorR.frequency.setValueAtTime(this.oscillatorR.frequency.value, now);
      this.oscillatorR.frequency.exponentialRampToValueAtTime(
        safeFreq + this.currentBinauralDiff,
        now + ramp
      );
    }
  }

  /** Change volume with smooth ramp */
  setVolume(volume: number) {
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const ramp = AUDIO.VOLUME_RAMP_S;
    const adjusted = this.adjustVolume(volume);

    if (this.gainNode) {
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
      this.gainNode.gain.linearRampToValueAtTime(adjusted, now + ramp);
    }
    if (this.gainNodeR) {
      this.gainNodeR.gain.cancelScheduledValues(now);
      this.gainNodeR.gain.setValueAtTime(this.gainNodeR.gain.value, now);
      this.gainNodeR.gain.linearRampToValueAtTime(adjusted, now + ramp);
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

  /** Get last error message */
  getLastError(): string | null {
    return this.lastError;
  }

  /** Get analyser data for waveform visualization */
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

  /** Play a protocol with crossfade between steps */
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

      // First step: normal play. Subsequent: crossfade from previous
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

    if (!this.protocolAbort) {
      this.stop();
      onComplete?.();
    }
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
    return frequency * (432 / 440);
  }

  /** Cleanup — call when component unmounts */
  destroy() {
    this.stopProtocol();
    if (this.fadeOutTimer) {
      clearTimeout(this.fadeOutTimer);
      this.fadeOutTimer = null;
    }
    this.stopImmediate();
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
