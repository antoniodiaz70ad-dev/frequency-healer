import { Waveform } from './types';
import { AUDIO } from './constants';

interface ToneConfig {
  frequency: number;
  duration: number;
  waveform: Waveform;
  volume?: number;
  sampleRate?: number;
}

interface BinauralConfig {
  baseFrequency: number;
  beatFrequency: number;
  duration: number;
  waveform?: Waveform;
  volume?: number;
  sampleRate?: number;
}

interface ProtocolStepConfig {
  frequencyHz: number;
  durationSeconds: number;
  waveform: Waveform;
  volume: number;
  binaural?: { enabled: boolean; differenceHz: number };
}

function encodeWAV(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const headerLength = 44;
  const totalLength = headerLength + dataLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalLength - 8, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Interleave channels and convert to Int16
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

async function renderTone(config: ToneConfig): Promise<AudioBuffer> {
  const sampleRate = config.sampleRate ?? AUDIO.SAMPLE_RATE;
  const volume = config.volume ?? AUDIO.DEFAULT_VOLUME;
  const totalSamples = Math.ceil(config.duration * sampleRate);

  const offCtx = new OfflineAudioContext(1, totalSamples, sampleRate);

  const osc = offCtx.createOscillator();
  osc.type = config.waveform;
  osc.frequency.setValueAtTime(config.frequency, 0);

  const gain = offCtx.createGain();
  const fadeIn = AUDIO.FADE_IN_S;
  const fadeOut = AUDIO.FADE_OUT_S;
  gain.gain.setValueAtTime(0, 0);
  gain.gain.linearRampToValueAtTime(volume, fadeIn);
  gain.gain.setValueAtTime(volume, config.duration - fadeOut);
  gain.gain.linearRampToValueAtTime(0, config.duration);

  osc.connect(gain);
  gain.connect(offCtx.destination);
  osc.start(0);
  osc.stop(config.duration);

  return offCtx.startRendering();
}

async function renderBinaural(config: BinauralConfig): Promise<AudioBuffer> {
  const sampleRate = config.sampleRate ?? AUDIO.SAMPLE_RATE;
  const volume = config.volume ?? AUDIO.DEFAULT_VOLUME;
  const waveform = config.waveform ?? 'sine';
  const totalSamples = Math.ceil(config.duration * sampleRate);

  const offCtx = new OfflineAudioContext(2, totalSamples, sampleRate);

  const fadeIn = AUDIO.FADE_IN_S;
  const fadeOut = AUDIO.FADE_OUT_S;

  // Left channel
  const oscL = offCtx.createOscillator();
  oscL.type = waveform;
  oscL.frequency.setValueAtTime(config.baseFrequency, 0);
  const gainL = offCtx.createGain();
  gainL.gain.setValueAtTime(0, 0);
  gainL.gain.linearRampToValueAtTime(volume, fadeIn);
  gainL.gain.setValueAtTime(volume, config.duration - fadeOut);
  gainL.gain.linearRampToValueAtTime(0, config.duration);
  const panL = offCtx.createStereoPanner();
  panL.pan.setValueAtTime(-1, 0);
  oscL.connect(gainL);
  gainL.connect(panL);
  panL.connect(offCtx.destination);
  oscL.start(0);
  oscL.stop(config.duration);

  // Right channel
  const oscR = offCtx.createOscillator();
  oscR.type = waveform;
  oscR.frequency.setValueAtTime(config.baseFrequency + config.beatFrequency, 0);
  const gainR = offCtx.createGain();
  gainR.gain.setValueAtTime(0, 0);
  gainR.gain.linearRampToValueAtTime(volume, fadeIn);
  gainR.gain.setValueAtTime(volume, config.duration - fadeOut);
  gainR.gain.linearRampToValueAtTime(0, config.duration);
  const panR = offCtx.createStereoPanner();
  panR.pan.setValueAtTime(1, 0);
  oscR.connect(gainR);
  gainR.connect(panR);
  panR.connect(offCtx.destination);
  oscR.start(0);
  oscR.stop(config.duration);

  return offCtx.startRendering();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportToneAsWAV(config: ToneConfig): Promise<void> {
  const buffer = await renderTone(config);
  const blob = encodeWAV(buffer);
  const filename = `freq_${config.frequency}hz_${config.waveform}_${config.duration}s.wav`;
  downloadBlob(blob, filename);
}

export async function exportBinauralAsWAV(config: BinauralConfig): Promise<void> {
  const buffer = await renderBinaural(config);
  const blob = encodeWAV(buffer);
  const filename = `binaural_${config.baseFrequency}hz_beat${config.beatFrequency}hz_${config.duration}s.wav`;
  downloadBlob(blob, filename);
}

export async function exportProtocolAsWAV(
  steps: ProtocolStepConfig[],
  protocolName: string
): Promise<void> {
  const sampleRate = AUDIO.SAMPLE_RATE;
  const silenceGap = 0.5;

  // Render each step
  const buffers: AudioBuffer[] = [];
  for (const step of steps) {
    let buf: AudioBuffer;
    if (step.binaural?.enabled && step.binaural.differenceHz > 0) {
      buf = await renderBinaural({
        baseFrequency: step.frequencyHz,
        beatFrequency: step.binaural.differenceHz,
        duration: step.durationSeconds,
        waveform: step.waveform,
        volume: step.volume,
        sampleRate,
      });
    } else {
      buf = await renderTone({
        frequency: step.frequencyHz,
        duration: step.durationSeconds,
        waveform: step.waveform,
        volume: step.volume,
        sampleRate,
      });
    }
    buffers.push(buf);
  }

  // Calculate total length with silence gaps
  const numChannels = Math.max(...buffers.map(b => b.numberOfChannels));
  const silenceSamples = Math.ceil(silenceGap * sampleRate);
  let totalSamples = 0;
  for (let i = 0; i < buffers.length; i++) {
    totalSamples += buffers[i].length;
    if (i < buffers.length - 1) totalSamples += silenceSamples;
  }

  // Merge into single buffer
  const offCtx = new OfflineAudioContext(numChannels, totalSamples, sampleRate);
  let offset = 0;
  for (let i = 0; i < buffers.length; i++) {
    const source = offCtx.createBufferSource();
    source.buffer = buffers[i];
    source.connect(offCtx.destination);
    source.start(offset / sampleRate);
    offset += buffers[i].length;
    if (i < buffers.length - 1) offset += silenceSamples;
  }

  const merged = await offCtx.startRendering();
  const blob = encodeWAV(merged);
  const safeName = protocolName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  downloadBlob(blob, `protocolo_${safeName}.wav`);
}
