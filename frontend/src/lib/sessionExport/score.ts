import { compositionMix, validateComposition, type ComposerRecipe } from '../marina/composer';
import { marinaPhases, validateMarinaAudio, type MarinaAudioConfig, type MarinaProtocol } from '../marina/model';
import { crystalPhases, crystalTimeline, validatePreparation, type CrystalPreparation } from '../crystals/model';
import { guideCues, type GuideCue } from '../narration/arthur';
import { ARTHUR_VOICE_VERSION } from '../narration/manifest';

export type ExportVoice = { enabled: boolean; source: 'arthur' | 'device'; volume: number };
export type ExportTone = { mode: 'tone' | 'pulse' | 'binaural'; hz: number; rate: number; depth: number; gain: number };
export type ExportStep = { at: number; seconds: number; fade: number; tones: ExportTone[] };
export type ExportScore = {
  schemaVersion: 1; renderer: 'pcm-session-1'; title: string; seconds: number; volume: number;
  steps: ExportStep[]; voice: { version: string; volume: number; cues: GuideCue[]; phases: number };
  configuration: unknown;
};
const noVoice = () => ({ version: ARTHUR_VOICE_VERSION, volume: 0, cues: [], phases: 0 });
function level(volume: number, max: number) {
  if (!Number.isFinite(volume) || volume < 0 || volume > max) throw new Error('Revisa el volumen antes de preparar la descarga.');
  return volume;
}
function narration(phases: readonly { id: string; seconds: number }[], family: 'crystals' | 'marina', voice: ExportVoice) {
  level(voice.volume, 1);
  if (voice.enabled && voice.source !== 'arthur') throw new Error('La descarga no incluye la voz del dispositivo. Elige Arthur o desactiva «Leer instrucciones con voz».');
  return { version: ARTHUR_VOICE_VERSION, volume: voice.enabled ? voice.volume : 0, cues: voice.enabled ? guideCues(phases, family) : [], phases: phases.length };
}
export function composerScore(recipe: ComposerRecipe, volume: number): ExportScore {
  validateComposition(recipe);
  const layers = compositionMix(recipe);
  if (!layers.length) throw new Error('Activa al menos una capa para descargar.');
  return { schemaVersion: 1, renderer: 'pcm-session-1', title: recipe.name, seconds: recipe.durationMinutes * 60, volume: level(volume, .6),
    steps: [{ at: 0, seconds: recipe.durationMinutes * 60, fade: recipe.transitionSeconds, tones: layers.map(l => ({ mode: l.mode, hz: l.carrierHz, rate: l.rateHz, depth: l.depth, gain: l.gain })) }],
    voice: noVoice(), configuration: structuredClone(recipe) };
}
export function crystalScore(preparation: CrystalPreparation, volume: number, voice: ExportVoice): ExportScore {
  validatePreparation(preparation, true);
  let at = 0;
  return { schemaVersion: 1, renderer: 'pcm-session-1', title: `Cristales · ${preparation.crystal}`, seconds: preparation.duration * 60, volume: level(volume, .6),
    steps: crystalTimeline(preparation).map(s => { const step = { at, seconds: s.seconds, fade: .25, tones: s.tones.map(t => ({ mode: 'tone' as const, hz: t.hz, rate: 1, depth: 0, gain: t.level })) }; at += s.seconds; return step; }),
    voice: preparation.exposure === 'coils' ? noVoice() : narration(crystalPhases(preparation.duration), 'crystals', voice), configuration: structuredClone(preparation) };
}
export function marinaScore(config: MarinaAudioConfig, protocol: MarinaProtocol | null, minutes: number, sound: boolean, volume: number, voice: ExportVoice, hasPhrase = false): ExportScore {
  validateMarinaAudio(config);
  if (protocol === 'creation12' && hasPhrase) throw new Error('La descarga de la grabación personal todavía no está disponible. El recorrido de 24 minutos y la exploración libre sí se pueden exportar.');
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 240) throw new Error('Revisa la duración para descargar.');
  const phases = protocol ? marinaPhases(protocol) : [{ id: 'free', seconds: minutes * 60, mode: config.mode, hz: config.hz }];
  let at = 0;
  const steps = phases.map(p => {
    const mode = sound ? p.mode : 'silence';
    const step: ExportStep = { at, seconds: p.seconds, fade: .04, tones: mode === 'silence' ? [] : [{ mode: mode === 'direct' ? 'tone' : mode, hz: mode === 'direct' ? p.hz : config.carrierHz, rate: p.hz, depth: 1, gain: 1 }] };
    at += p.seconds; return step;
  });
  return { schemaVersion: 1, renderer: 'pcm-session-1', title: protocol ? `Marina · ${at / 60} minutos` : 'Marina · Exploración libre', seconds: at, volume: level(volume, 1), steps,
    voice: protocol ? narration(phases, 'marina', voice) : noVoice(), configuration: structuredClone({ config, protocol, minutes, sound }) };
}

/** Bounded file size; reject rather than silently shorten or alias frequencies. */
export function exportFormat(score: ExportScore) {
  const highest = Math.max(0, ...score.steps.flatMap(s => s.tones.map(t => t.hz + (t.mode === 'tone' ? 0 : t.rate))));
  // Keep the existing recordings at their native 44.1 kHz when voice is included.
  const sampleRate = highest < 11025 && !score.voice.cues.length ? 22050 : 44100;
  if (highest >= sampleRate / 2) throw new Error('Una frecuencia supera el formato de descarga disponible.');
  const frames = Math.round(score.seconds * sampleRate), bytes = 44 + frames * 4;
  if (!Number.isFinite(score.seconds) || score.seconds <= 0 || bytes > 256 * 1024 * 1024) throw new Error('Esta sesión supera el límite de descarga de 256 MiB. Reduce su duración.');
  return { sampleRate, frames, bytes };
}
