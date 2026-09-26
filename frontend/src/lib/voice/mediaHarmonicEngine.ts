import { buildSchedule, masterGain, voiceGain, type HarmonicConfig, type HarmonicSchedule } from '../harmonic/math';

export interface GuidedPlaybackEngine {
  start(config: HarmonicConfig, onComplete?: () => void): Promise<boolean>;
  stop(): void;
  dispose(): void;
  elapsedMs(): number;
  snapshot(): { stepIndex: number | null; activeHz: number[] };
  isPlaying(): boolean;
  getVolume(): number;
  setVolume(volume: number): void;
  duck(): Promise<boolean>;
  restore(): void;
}

export const IOS_BACKGROUND_MAX_SECONDS = 30 * 60;
const SAMPLE_RATE = 22050;
const BYTES_PER_SAMPLE = 2;
const CHANNELS = 1;
const FADE_SECONDS = 0.03;

export function isIOSLike(userAgent = globalThis.navigator?.userAgent ?? '') {
  const platform = globalThis.navigator?.platform ?? '';
  const touchPoints = globalThis.navigator?.maxTouchPoints ?? 0;
  return /iPad|iPhone|iPod/i.test(userAgent) || (platform === 'MacIntel' && touchPoints > 1);
}

export function renderHarmonicConfigToWavBlob(config: HarmonicConfig): { blob: Blob; schedule: HarmonicSchedule } {
  const schedule = buildSchedule(config);
  if (schedule.durationSeconds > IOS_BACKGROUND_MAX_SECONDS) {
    throw new Error('Modo iPhone admite sesiones de hasta 30 minutos. Reduce la duración o mantén la pantalla activa.');
  }

  const sampleCount = Math.max(1, Math.ceil(schedule.durationSeconds * SAMPLE_RATE));
  const samples = new Float32Array(sampleCount);
  const amplitude = masterGain(config.uiVolume);

  for (const step of schedule.steps) {
    const startSample = Math.max(0, Math.floor(step.offsetSeconds * SAMPLE_RATE));
    const endSample = Math.min(sampleCount, Math.ceil((step.offsetSeconds + step.durationSeconds) * SAMPLE_RATE));
    const stepSamples = Math.max(1, endSample - startSample);
    const perVoiceGain = voiceGain(step.frequencies.length);

    for (let i = startSample; i < endSample; i += 1) {
      const stepTime = (i - startSample) / SAMPLE_RATE;
      const absoluteTime = i / SAMPLE_RATE;
      const fadeIn = Math.min(1, stepTime / FADE_SECONDS);
      const fadeOut = Math.min(1, (stepSamples - (i - startSample)) / (FADE_SECONDS * SAMPLE_RATE));
      const envelope = Math.max(0, Math.min(fadeIn, fadeOut));
      let value = 0;
      for (const hz of step.frequencies) {
        value += Math.sin(2 * Math.PI * hz * absoluteTime) * perVoiceGain;
      }
      samples[i] += value * amplitude * envelope;
    }
  }

  return { blob: encodePcmWav(samples, SAMPLE_RATE), schedule };
}

function encodePcmWav(samples: Float32Array, sampleRate: number): Blob {
  const dataBytes = samples.length * BYTES_PER_SAMPLE;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, CHANNELS, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * CHANNELS * BYTES_PER_SAMPLE, true);
  view.setUint16(32, CHANNELS * BYTES_PER_SAMPLE, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
}

export class MediaHarmonicEngine implements GuidedPlaybackEngine {
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  private schedule: HarmonicSchedule | null = null;
  private volume = 20;
  private factor = 1;
  private active = false;
  private completionHandler: (() => void) | null = null;

  async start(config: HarmonicConfig, onComplete: () => void = () => {}) {
    this.stop();
    const { blob, schedule } = renderHarmonicConfigToWavBlob(config);
    const audio = new Audio();
    const objectUrl = URL.createObjectURL(blob);
    this.audio = audio;
    this.objectUrl = objectUrl;
    this.schedule = schedule;
    this.volume = config.uiVolume;
    this.factor = 1;
    this.completionHandler = onComplete;
    audio.src = objectUrl;
    audio.preload = 'auto';
    audio.volume = masterGain(this.volume);
    audio.loop = false;
    audio.onended = () => {
      const complete = this.completionHandler;
      this.release(false);
      complete?.();
    };
    audio.onerror = () => {
      this.release(false);
    };
    try {
      await audio.play();
      this.active = true;
      return true;
    } catch {
      this.release(false);
      throw new Error('No se pudo iniciar el audio. Confirma de nuevo o usa otro navegador.');
    }
  }

  elapsedMs() {
    if (!this.schedule || !this.audio) return 0;
    return Math.min(this.schedule.durationSeconds * 1000, Math.max(0, this.audio.currentTime * 1000));
  }

  snapshot() {
    const seconds = this.elapsedMs() / 1000;
    const index = this.schedule?.steps.findIndex(s => seconds >= s.offsetSeconds && seconds < s.offsetSeconds + s.durationSeconds) ?? -1;
    return { stepIndex: index < 0 ? null : index, activeHz: index < 0 ? [] : [...this.schedule!.steps[index].frequencies] };
  }

  isPlaying() { return this.active; }
  getVolume() { return this.volume; }

  setVolume(volume: number) {
    masterGain(volume);
    this.volume = volume;
    this.applyVolume();
  }

  async duck() {
    if (!this.active) return false;
    this.factor = 0.25;
    this.applyVolume();
    await new Promise(resolve => setTimeout(resolve, 150));
    return this.active;
  }

  restore() {
    if (!this.active) return;
    this.factor = 1;
    this.applyVolume();
  }

  stop() { this.release(true); }
  dispose() { this.stop(); }

  private applyVolume() {
    if (this.audio) this.audio.volume = Math.max(0, Math.min(1, masterGain(this.volume) * this.factor));
  }

  private release(pause: boolean) {
    const audio = this.audio;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      if (pause) audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.audio = null;
    this.objectUrl = null;
    this.schedule = null;
    this.active = false;
    this.completionHandler = null;
  }
}
