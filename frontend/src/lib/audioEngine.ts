import { Waveform, OutputMode, BinauralLayer } from './types';

/**
 * Motor de Audio basado en Web Audio API.
 * Genera tonos, binaural beats, acordes multicapa, y maneja protocolos de frecuencias.
 */

interface ChordVoice {
  oscL: OscillatorNode;
  oscR: OscillatorNode;
  gainL: GainNode;
  gainR: GainNode;
  panL: StereoPannerNode;
  panR: StereoPannerNode;
}

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

  // ── Chord (Hemi-Sync style) state ──
  private chordVoices: ChordVoice[] = [];
  private pinkNoiseSource: AudioBufferSourceNode | null = null;
  private pinkNoiseGain: GainNode | null = null;
  private masterGain: GainNode | null = null;

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

    // Stop chord voices (Hemi-Sync style multilayer)
    for (const voice of this.chordVoices) {
      try { voice.oscL.stop(); } catch {}
      try { voice.oscR.stop(); } catch {}
      voice.oscL.disconnect();
      voice.oscR.disconnect();
      voice.gainL.disconnect();
      voice.gainR.disconnect();
      voice.panL.disconnect();
      voice.panR.disconnect();
    }
    this.chordVoices = [];

    // Stop pink noise
    try { this.pinkNoiseSource?.stop(); } catch {}
    this.pinkNoiseSource?.disconnect();
    this.pinkNoiseGain?.disconnect();
    this.pinkNoiseSource = null;
    this.pinkNoiseGain = null;

    this.masterGain?.disconnect();
    this.analyser?.disconnect();
    this.masterGain = null;

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
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(volume, this.ctx.currentTime);
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

  /**
   * Reproduce un "acorde" multicapa de batidos binaurales con ruido rosa
   * opcional, al estilo Hemi-Sync. Cada capa es un par L/R con su propio
   * carrier y beat. Las portadoras deben mantenerse <1500 Hz para que el
   * tronco encefálico procese el diferencial de fase.
   */
  playChord(
    layers: BinauralLayer[],
    options: { masterVolume?: number; pinkNoiseGain?: number } = {}
  ) {
    this.stop();
    const ctx = this.getContext();
    const { masterVolume = 0.5, pinkNoiseGain = 0 } = options;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(masterVolume, ctx.currentTime);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    // Build each binaural layer
    for (const layer of layers) {
      const safeCarrier = Math.min(layer.carrierHz, 1500);
      const freqL = safeCarrier;
      const freqR = safeCarrier + layer.beatHz;

      const oscL = ctx.createOscillator();
      oscL.type = layer.waveform;
      oscL.frequency.setValueAtTime(freqL, ctx.currentTime);
      const gainL = ctx.createGain();
      gainL.gain.setValueAtTime(layer.gain, ctx.currentTime);
      const panL = ctx.createStereoPanner();
      panL.pan.setValueAtTime(-1, ctx.currentTime);
      oscL.connect(gainL);
      gainL.connect(panL);
      panL.connect(this.masterGain);

      const oscR = ctx.createOscillator();
      oscR.type = layer.waveform;
      oscR.frequency.setValueAtTime(freqR, ctx.currentTime);
      const gainR = ctx.createGain();
      gainR.gain.setValueAtTime(layer.gain, ctx.currentTime);
      const panR = ctx.createStereoPanner();
      panR.pan.setValueAtTime(1, ctx.currentTime);
      oscR.connect(gainR);
      gainR.connect(panR);
      panR.connect(this.masterGain);

      oscL.start();
      oscR.start();

      this.chordVoices.push({ oscL, oscR, gainL, gainR, panL, panR });
    }

    // Pink noise bed
    if (pinkNoiseGain > 0) {
      this.pinkNoiseSource = this.createPinkNoiseSource(ctx);
      this.pinkNoiseGain = ctx.createGain();
      this.pinkNoiseGain.gain.setValueAtTime(pinkNoiseGain, ctx.currentTime);
      this.pinkNoiseSource.connect(this.pinkNoiseGain);
      this.pinkNoiseGain.connect(this.masterGain);
      this.pinkNoiseSource.start();
    }

    this.isPlaying = true;
  }

  /**
   * Genera 2 segundos de ruido rosa en loop usando el algoritmo de Paul Kellet.
   * El ruido rosa, a diferencia del blanco, tiene -3 dB/octava y se ajusta
   * mejor a la curva de percepción auditiva humana.
   */
  private createPinkNoiseSource(ctx: AudioContext): AudioBufferSourceNode {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
  }

  /**
   * Detecta si el dispositivo de salida soporta estéreo. La efectividad de
   * los batidos binaurales depende de tonos dicóticos aislados por canal.
   * Esto comprueba la capacidad declarada al sistema, no si el usuario
   * tiene auriculares conectados físicamente — para eso se requiere
   * confirmación explícita del usuario.
   */
  static supportsStereo(): boolean {
    if (typeof window === 'undefined') return true;
    try {
      const ctx = new AudioContext();
      const supported = ctx.destination.maxChannelCount >= 2;
      ctx.close();
      return supported;
    } catch {
      return true;
    }
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
