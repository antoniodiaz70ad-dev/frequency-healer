import type { ExportScore } from './score';
export type VoicePcm = { key: string; at: number; seconds: number; sampleRate: number; channels: Float32Array[] };
export function wavHeader(frames: number, sampleRate: number) {
  const buffer = new ArrayBuffer(44), view = new DataView(buffer);
  const ascii = (at: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i)); };
  ascii(0, 'RIFF'); view.setUint32(4, 36 + frames * 4, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true);
  ascii(36, 'data'); view.setUint32(40, frames * 4, true); return buffer;
}
const edge = (t: number, seconds: number, fade: number) => Math.max(0, Math.min(1, t / fade, (seconds - t) / fade));
export function mixDivisor(score: ExportScore, voices: VoicePcm[]) {
  let voicePeak = 0;
  for (const v of voices) for (const channel of v.channels) for (const value of channel) voicePeak = Math.max(voicePeak, Math.abs(value));
  const toneBound = Math.max(0, ...score.steps.map(s => s.tones.reduce((sum, t) => sum + t.gain, 0))) * score.volume;
  // One fixed attenuation for the whole session; preserves relative levels and avoids clipping.
  return Math.max(1, toneBound + voicePeak * score.voice.volume);
}
export function renderPcmChunk(score: ExportScore, sampleRate: number, first: number, frames: number, voices: VoicePcm[], divisor: number) {
  const buffer = new ArrayBuffer(frames * 4), view = new DataView(buffer), tau = 2 * Math.PI;
  const end = (first + frames) / sampleRate, begin = first / sampleRate;
  const steps = score.steps.filter(s => s.at < end && s.at + s.seconds > begin);
  const cues = voices.filter(v => v.at < end && v.at + v.seconds > begin);
  for (let i = 0; i < frames; i++) {
    const t = (first + i) / sampleRate;
    let left = 0, right = 0;
    for (const step of steps) {
      const local = t - step.at;
      if (local < 0 || local >= step.seconds) continue;
      const envelope = edge(local, step.seconds, Math.min(step.fade, step.seconds / 2)) * score.volume;
      for (const tone of step.tones) {
        const gain = envelope * tone.gain * (tone.mode === 'pulse' ? 1 - tone.depth / 2 + tone.depth / 2 * Math.sin(tau * tone.rate * local) : 1);
        left += Math.sin(tau * tone.hz * local) * gain;
        right += Math.sin(tau * (tone.hz + (tone.mode === 'binaural' ? tone.rate : 0)) * local) * gain;
      }
    }
    for (const cue of cues) {
      const local = t - cue.at;
      if (local < 0 || local >= cue.seconds) continue;
      const frame = Math.floor(local * cue.sampleRate), gain = score.voice.volume * edge(local, cue.seconds, Math.min(.02, cue.seconds / 2));
      left += (cue.channels[0][frame] ?? 0) * gain;
      right += (cue.channels[1]?.[frame] ?? cue.channels[0][frame] ?? 0) * gain;
    }
    view.setInt16(i * 4, Math.round(Math.max(-1, Math.min(1, left / divisor)) * 32767), true);
    view.setInt16(i * 4 + 2, Math.round(Math.max(-1, Math.min(1, right / divisor)) * 32767), true);
  }
  return buffer;
}
