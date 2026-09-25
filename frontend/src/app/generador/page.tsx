"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Waveform, OutputMode, FocusLevelPreset } from "@/lib/types";
import { getAudioEngine, AudioEngine } from "@/lib/audioEngine";
import { FREQUENCY_DATABASE, WAVEFORM_INFO, DOMAIN_INFO } from "@/lib/frequencies";
import {
  FOCUS_LEVEL_PRESETS,
  SOLFEGGIO_CHORDS,
  BAND_LABEL,
} from "@/lib/focusLevels";
import AudioVisualizer from "@/components/AudioVisualizer";
import SafetyDisclaimerModal, {
  hasAcceptedDisclaimer,
} from "@/components/SafetyDisclaimerModal";
import Link from "next/link";
import { FHPageHeader, FHPageShell, FHSurface } from "@/components/ui/FHLayout";
import { FHDangerAction, FHPrimaryAction } from "@/components/ui/FHActions";
import FHDisclosure from "@/components/ui/FHDisclosure";
import { playbackWakeLockMessage, usePlaybackWakeLock } from "@/lib/playbackLifecycle";

const PRESETS = [
  { label: "528 Hz Solfeggio", hz: 528, waveform: "sine" as Waveform, color: "#fbbf24" },
  { label: "432 Hz Natural", hz: 432, waveform: "sine" as Waveform, color: "#4ade80" },
  { label: "40 Hz Gamma", hz: 40, waveform: "sine" as Waveform, color: "#60a5fa" },
  { label: "7.83 Hz Schumann", hz: 7.83, waveform: "sine" as Waveform, color: "#a78bfa" },
  { label: "174 Hz Solfeggio", hz: 174, waveform: "sine" as Waveform, color: "#f87171" },
  { label: "963 Hz Solfeggio", hz: 963, waveform: "sine" as Waveform, color: "#67e8f9" },
  { label: "727 Hz Rife (histórico)", hz: 727, waveform: "square" as Waveform, color: "#f87171" },
  { label: "880 Hz Rife (histórico)", hz: 880, waveform: "square" as Waveform, color: "#fb923c" },
];

type Tab = "tone" | "hemi-sync";

export default function GeneradorPage() {
  const [tab, setTab] = useState<Tab>("tone");

  const [frequency, setFrequency] = useState(528);
  const [waveform, setWaveform] = useState<Waveform>("sine");
  const [volume, setVolume] = useState(50);
  const [isPlaying, setIsPlaying] = useState(false);
  const wakeLockMessage = playbackWakeLockMessage(usePlaybackWakeLock(isPlaying));
  const [outputMode, setOutputMode] = useState<OutputMode>("speakers");
  const [tuning432, setTuning432] = useState(false);
  const [binaural, setBinaural] = useState(false);
  const [binauralDiff, setBinauralDiff] = useState(10);
  const [dwellTime, setDwellTime] = useState(0); // 0 = continuous
  const dwellTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (dwellTimer.current) clearTimeout(dwellTimer.current);
    getAudioEngine().stopProtocol();
  }, []);

  // Hemi-Sync state
  const [selectedChord, setSelectedChord] = useState<FocusLevelPreset>(FOCUS_LEVEL_PRESETS[0]);
  const [chordVolume, setChordVolume] = useState(40);
  const [pinkNoiseEnabled, setPinkNoiseEnabled] = useState(true);
  const [chordDuration, setChordDuration] = useState(0); // 0 = preset default
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const effectiveFreq = tuning432 ? AudioEngine.to432(frequency) : frequency;

  const handlePlay = useCallback(() => {
    if (dwellTimer.current) clearTimeout(dwellTimer.current);
    const engine = getAudioEngine();
    engine.setOutputMode(outputMode);
    engine.play(effectiveFreq, waveform, volume / 100, {
      enabled: binaural,
      differenceHz: binauralDiff,
    });
    setIsPlaying(true);

    if (dwellTime > 0) {
      const timer = setTimeout(() => {
        engine.stop();
        setIsPlaying(false);
      }, dwellTime * 1000);
      dwellTimer.current = timer;
    }
  }, [effectiveFreq, waveform, volume, outputMode, binaural, binauralDiff, dwellTime]);

  const handleStop = useCallback(() => {
    const engine = getAudioEngine();
    engine.stop();
    setIsPlaying(false);
    if (dwellTimer.current) {
      clearTimeout(dwellTimer.current);
      dwellTimer.current = null;
    }
  }, []);

  const playChord = useCallback(() => {
    if (dwellTimer.current) clearTimeout(dwellTimer.current);
    const engine = getAudioEngine();
    engine.playChord(selectedChord.layers, {
      masterVolume: chordVolume / 100,
      pinkNoiseGain: pinkNoiseEnabled ? selectedChord.pinkNoiseGain : 0,
    });
    setIsPlaying(true);

    const minutes = chordDuration > 0 ? chordDuration : selectedChord.durationMinutes;
    const timer = setTimeout(() => {
      engine.stop();
      setIsPlaying(false);
    }, minutes * 60 * 1000);
    dwellTimer.current = timer;
  }, [selectedChord, chordVolume, pinkNoiseEnabled, chordDuration]);

  const requestPlayChord = useCallback(() => {
    if (hasAcceptedDisclaimer()) {
      playChord();
    } else {
      setShowDisclaimer(true);
    }
  }, [playChord]);

  const applyPreset = (hz: number, wf: Waveform) => {
    setFrequency(hz);
    setWaveform(wf);
    if (isPlaying) {
      handleStop();
    }
  };

  const freqInfo = FREQUENCY_DATABASE.find((f) => Math.abs(f.hz - frequency) < 0.5);

  return (
    <FHPageShell width="default" className="legacy-page generator-page animate-fade-in">
      <FHPageHeader eyebrow="INSTRUMENTO · AVANZADO" title="Generador manual" description="Configura una señal directamente. Para una experiencia guiada, usa Sesión guiada." />
      <FHSurface variant="subtle" className="generator-note"><p>Esta es una herramienta manual avanzada. Frequency Healer no interpreta una frecuencia aislada como tratamiento o resultado garantizado.</p><Link href="/voz">Ir a Sesión guiada</Link></FHSurface>
      {wakeLockMessage && <p className="text-xs text-gray-500 mb-4">{wakeLockMessage}</p>}

      {/* Tabs */}
      <div className="legacy-tabs" aria-label="Tipo de generador">
        <button
          onClick={() => {
            if (isPlaying) handleStop();
            setTab("tone");
          }}
          className={`px-4 py-2 text-xs rounded-lg transition-colors ${
            tab === "tone" ? "bg-[#1f2937] text-white" : "text-gray-500 hover:text-white"
          }`}
        >
          Tono Simple
        </button>
        <button
          onClick={() => {
            if (isPlaying) handleStop();
            setTab("hemi-sync");
          }}
          className={`px-4 py-2 text-xs rounded-lg transition-colors ${
            tab === "hemi-sync" ? "bg-[#1f2937] text-white" : "text-gray-500 hover:text-white"
          }`}
        >
          🧠 Acordes Multicapa
        </button>
      </div>

      {tab === "tone" ? (
        <ToneTab
          frequency={frequency}
          setFrequency={setFrequency}
          waveform={waveform}
          setWaveform={setWaveform}
          volume={volume}
          setVolume={setVolume}
          isPlaying={isPlaying}
          outputMode={outputMode}
          setOutputMode={setOutputMode}
          tuning432={tuning432}
          setTuning432={setTuning432}
          binaural={binaural}
          setBinaural={setBinaural}
          binauralDiff={binauralDiff}
          setBinauralDiff={setBinauralDiff}
          dwellTime={dwellTime}
          setDwellTime={setDwellTime}
          effectiveFreq={effectiveFreq}
          freqInfo={freqInfo}
          handlePlay={handlePlay}
          handleStop={handleStop}
          applyPreset={applyPreset}
        />
      ) : (
        <HemiSyncTab
          selectedChord={selectedChord}
          setSelectedChord={(c) => {
            if (isPlaying) handleStop();
            setSelectedChord(c);
          }}
          chordVolume={chordVolume}
          setChordVolume={(v) => {
            setChordVolume(v);
            if (isPlaying) getAudioEngine().setVolume(v / 100);
          }}
          pinkNoiseEnabled={pinkNoiseEnabled}
          setPinkNoiseEnabled={setPinkNoiseEnabled}
          chordDuration={chordDuration}
          setChordDuration={setChordDuration}
          isPlaying={isPlaying}
          onPlay={requestPlayChord}
          onStop={handleStop}
        />
      )}

      {showDisclaimer && (
        <SafetyDisclaimerModal
          onAccept={() => {
            setShowDisclaimer(false);
            playChord();
          }}
          onCancel={() => setShowDisclaimer(false)}
        />
      )}
    </FHPageShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface ToneTabProps {
  frequency: number;
  setFrequency: (v: number | ((f: number) => number)) => void;
  waveform: Waveform;
  setWaveform: (v: Waveform) => void;
  volume: number;
  setVolume: (v: number) => void;
  isPlaying: boolean;
  outputMode: OutputMode;
  setOutputMode: (v: OutputMode) => void;
  tuning432: boolean;
  setTuning432: (v: boolean) => void;
  binaural: boolean;
  setBinaural: (v: boolean) => void;
  binauralDiff: number;
  setBinauralDiff: (v: number) => void;
  dwellTime: number;
  setDwellTime: (v: number) => void;
  effectiveFreq: number;
  freqInfo: ReturnType<typeof FREQUENCY_DATABASE.find>;
  handlePlay: () => void;
  handleStop: () => void;
  applyPreset: (hz: number, wf: Waveform) => void;
}

function ToneTab({
  frequency,
  setFrequency,
  waveform,
  setWaveform,
  volume,
  setVolume,
  isPlaying,
  outputMode,
  setOutputMode,
  tuning432,
  setTuning432,
  binaural,
  setBinaural,
  binauralDiff,
  setBinauralDiff,
  dwellTime,
  setDwellTime,
  effectiveFreq,
  freqInfo,
  handlePlay,
  handleStop,
  applyPreset,
}: ToneTabProps) {
  return (
    <>
      <p className="fh-label generator-stage">Configure · Configurar</p>
      {/* Visualizer */}
      <div className="mb-6">
        <AudioVisualizer isPlaying={isPlaying} color={freqInfo ? DOMAIN_INFO[freqInfo.domain[0]]?.color : "#60a5fa"} />
      </div>

      {/* Main frequency display */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-6 mb-6 text-center">
        <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Frecuencia</p>
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => setFrequency((f: number) => Math.max(0.1, f - 1))} className="text-gray-500 hover:text-white text-2xl w-10 h-10 rounded-full border border-[#1f2937] flex items-center justify-center">−</button>
          <input
            type="number"
            value={frequency}
            onChange={(e) => setFrequency(Math.max(0.1, Number(e.target.value)))}
            className="bg-transparent text-5xl md:text-6xl font-bold font-mono text-[#60a5fa] text-center w-48 md:w-64 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            step="0.01"
          />
          <button onClick={() => setFrequency((f: number) => f + 1)} className="text-gray-500 hover:text-white text-2xl w-10 h-10 rounded-full border border-[#1f2937] flex items-center justify-center">+</button>
        </div>
        <p className="text-sm text-gray-500 mt-1">Hz</p>
        {tuning432 && frequency !== effectiveFreq && (
          <p className="text-xs text-[#4ade80] mt-1">432 Hz: {effectiveFreq.toFixed(2)} Hz</p>
        )}
        {freqInfo && (
          <div className="mt-3 p-3 rounded-lg bg-[#0d1117] border border-[#1f2937]">
            <p className="text-sm font-medium text-white">{freqInfo.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{freqInfo.description}</p>
          </div>
        )}

        <div className="mt-4">
          <input
            type="range"
            min={0.1}
            max={2000}
            step={0.1}
            value={Math.min(frequency, 2000)}
            onChange={(e) => setFrequency(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-[9px] text-gray-600 mt-1">
            <span>0.1 Hz</span><span>500</span><span>1000</span><span>1500</span><span>2000 Hz</span>
          </div>
        </div>
      </div>

      {/* Controls grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Forma de Onda</p>
          <div className="grid grid-cols-4 gap-2">
            {(["sine", "square", "triangle", "sawtooth"] as Waveform[]).map((w) => (
              <button
                key={w}
                onClick={() => setWaveform(w)}
                className={`p-2 rounded-lg border text-center text-xs transition-all ${waveform === w ? "border-[#60a5fa] bg-[#60a5fa15] text-[#60a5fa]" : "border-[#1f2937] text-gray-500 hover:text-white"}`}
              >
                <span className="text-lg block">{WAVEFORM_INFO[w].icon}</span>
                {WAVEFORM_INFO[w].label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Volumen: {volume}%</p>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => {
              setVolume(Number(e.target.value));
              if (isPlaying) getAudioEngine().setVolume(Number(e.target.value) / 100);
            }}
            className="w-full"
          />
          <div className="flex justify-between text-[9px] text-gray-600 mt-1">
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
        </div>

        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Binaural Beats</p>
            <button
              onClick={() => setBinaural(!binaural)}
              className={`w-10 h-5 rounded-full transition-colors ${binaural ? "bg-[#60a5fa]" : "bg-[#374151]"}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${binaural ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
          {binaural && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Diferencia: {binauralDiff} Hz ({binauralDiff <= 4 ? "Delta" : binauralDiff <= 8 ? "Theta" : binauralDiff <= 14 ? "Alpha" : binauralDiff <= 30 ? "Beta" : "Gamma"})</p>
              <input type="range" min={0.5} max={60} step={0.5} value={binauralDiff} onChange={(e) => setBinauralDiff(Number(e.target.value))} className="w-full" />
              <p className="text-[10px] text-gray-600 mt-1">Usa audífonos para efecto binaural</p>
            </div>
          )}
        </div>

        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">Salida</p>
            <div className="flex gap-1 bg-[#0d1117] rounded-lg p-0.5">
              <button onClick={() => setOutputMode("speakers")} className={`text-xs px-3 py-1 rounded-md ${outputMode === "speakers" ? "bg-[#1f2937] text-white" : "text-gray-500"}`}>🔊 Bocinas</button>
              <button onClick={() => setOutputMode("coils")} className={`text-xs px-3 py-1 rounded-md ${outputMode === "coils" ? "bg-[#1f2937] text-white" : "text-gray-500"}`}>🧲 Bobinas</button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">Afinación 432 Hz</p>
            <button onClick={() => setTuning432(!tuning432)} className={`w-10 h-5 rounded-full transition-colors ${tuning432 ? "bg-[#4ade80]" : "bg-[#374151]"}`}>
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${tuning432 ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">Temporizador</p>
            <select value={dwellTime} onChange={(e) => setDwellTime(Number(e.target.value))} className="bg-[#0d1117] border border-[#1f2937] rounded-md text-xs text-white px-2 py-1">
              <option value={0}>Continuo</option>
              <option value={60}>1 min</option>
              <option value={180}>3 min</option>
              <option value={300}>5 min</option>
              <option value={600}>10 min</option>
              <option value={1800}>30 min</option>
              <option value={3600}>60 min</option>
            </select>
          </div>
        </div>
      </div>

      <p className="fh-label generator-stage">Review · Revisar</p>
      <FHSurface variant="subtle" className="generator-review">
        <span>Configuración resultante</span><code>{effectiveFreq.toFixed(2)} Hz · {waveform} · volumen {volume}% · {binaural ? `binaural Δ ${binauralDiff} Hz` : "tono directo"} · {dwellTime ? `${dwellTime} s` : "continuo"}</code>
      </FHSurface>

      {/* Play / Stop */}
      <p className="fh-label generator-stage">Play · Reproducir</p>
      <div className="flex justify-center mb-8">
        {!isPlaying ? (
          <button
            onClick={handlePlay}
            className="w-20 h-20 rounded-full bg-[#60a5fa] hover:bg-[#3b82f6] text-white flex items-center justify-center text-3xl transition-all hover:scale-105 glow-active"
          >
            ▶
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="w-20 h-20 rounded-full bg-[#f87171] hover:bg-[#ef4444] text-white flex items-center justify-center text-2xl transition-all hover:scale-105"
          >
            ■
          </button>
        )}
      </div>

      {/* Presets */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-5">
        <h3 className="font-bold text-white text-sm mb-3">Presets Rápidos</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p.hz, p.waveform)}
              className="p-3 rounded-lg border border-[#1f2937] hover:border-[#374151] text-left transition-all group"
            >
              <p className="text-lg font-bold font-mono group-hover:text-white transition-colors" style={{ color: p.color }}>
                {p.hz}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">{p.label}</p>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface HemiSyncTabProps {
  selectedChord: FocusLevelPreset;
  setSelectedChord: (c: FocusLevelPreset) => void;
  chordVolume: number;
  setChordVolume: (v: number) => void;
  pinkNoiseEnabled: boolean;
  setPinkNoiseEnabled: (v: boolean) => void;
  chordDuration: number;
  setChordDuration: (v: number) => void;
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
}

function HemiSyncTab({
  selectedChord,
  setSelectedChord,
  chordVolume,
  setChordVolume,
  pinkNoiseEnabled,
  setPinkNoiseEnabled,
  chordDuration,
  setChordDuration,
  isPlaying,
  onPlay,
  onStop,
}: HemiSyncTabProps) {
  const effectiveDuration = chordDuration > 0 ? chordDuration : selectedChord.durationMinutes;

  return (
    <>
      <p className="fh-label generator-stage">Configure · Configurar</p>
      <div className="mb-6">
        <AudioVisualizer isPlaying={isPlaying} color={selectedChord.color} />
      </div>

      {/* Selected chord card */}
      <div
        className="obe-session-card"
        style={{ borderColor: selectedChord.color + "40" }}
      >
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">
              Acorde seleccionado
            </p>
            <h2 className="text-xl font-bold text-white">{selectedChord.label}</h2>
            <p className="text-xs text-gray-400 mt-1">{selectedChord.description}</p>
          </div>
          <div className="flex gap-1 flex-wrap justify-end">
            {selectedChord.bands.map((b) => (
              <span
                key={b}
                className="text-[10px] px-2 py-0.5 rounded-full border border-[#1f2937] text-gray-400"
              >
                {BAND_LABEL[b]}
              </span>
            ))}
          </div>
        </div>

        {/* Layer breakdown */}
        <FHDisclosure summary="Detalles acústicos">
          <div className="obe-session-layers">
            {selectedChord.layers.map((layer, i) => (
              <div key={i} className="obe-session-layer">
                <span>Capa {i + 1}</span><code>{layer.carrierHz} Hz / {layer.carrierHz + layer.beatHz} Hz</code><code>Δ {layer.beatHz.toFixed(1)} Hz</code>
              </div>
            ))}
          </div>
        </FHDisclosure>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="obe-surface">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
            Volumen: {chordVolume}%
          </p>
          <input
            type="range"
            min={0}
            max={100}
            value={chordVolume}
            onChange={(e) => setChordVolume(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div className="obe-surface">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider">
              Ruido rosa de fondo
            </p>
            <button
              onClick={() => setPinkNoiseEnabled(!pinkNoiseEnabled)}
              className={`w-10 h-5 rounded-full transition-colors ${pinkNoiseEnabled ? "bg-[#60a5fa]" : "bg-[#374151]"}`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${pinkNoiseEnabled ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </button>
          </div>
          <p className="text-[10px] text-gray-600">
            Capa de ruido ecualizado a la curva auditiva. Suaviza la transición y
            enmascara distracciones del entorno.
          </p>
        </div>

        <div className="obe-surface md:col-span-2">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
            Duración: {effectiveDuration} min
          </p>
          <div className="flex flex-wrap gap-2">
            {[0, 15, 30, 45, 60, 90, 180].map((d) => (
              <button
                key={d}
                onClick={() => setChordDuration(d)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                  chordDuration === d
                    ? "border-[#60a5fa] bg-[#60a5fa15] text-[#60a5fa]"
                    : "border-[#1f2937] text-gray-500 hover:text-white"
                }`}
              >
                {d === 0 ? `Default (${selectedChord.durationMinutes} min)` : `${d} min`}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-600 mt-2">
            Las dos duraciones canónicas en métodos de proyección son 90 min
            (uso nocturno) y 180 min (inmersión profunda).
          </p>
        </div>
      </div>

      <p className="fh-label generator-stage">Review · Revisar</p>
      <FHSurface variant="subtle" className="generator-review"><span>Configuración resultante</span><code>{selectedChord.label} · {selectedChord.layers.length} capas · volumen {chordVolume}% · {effectiveDuration} min</code></FHSurface>

      {/* Play / Stop */}
      <p className="fh-label generator-stage">Play · Reproducir</p>
      <div className="obe-session-actions" role="group" aria-label="Controles de reproducción de la sesión">
        {!isPlaying ? (
          <FHPrimaryAction onClick={onPlay} aria-label="Iniciar sesión binaural">▶ Iniciar sesión</FHPrimaryAction>
        ) : (
          <FHDangerAction onClick={onStop} aria-label="Detener sesión binaural">■ Detener sesión</FHDangerAction>
        )}
        <span role="status" className="obe-session-status">{isPlaying ? "Sesión en curso" : "Sesión detenida"}</span>
      </div>

      {/* Focus Levels grid */}
      <div className="obe-surface mb-4">
        <h3 className="font-bold text-white text-sm mb-3">Niveles de Enfoque</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {FOCUS_LEVEL_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedChord(p)}
              className={`p-3 rounded-lg border text-left transition-all ${
                selectedChord.id === p.id
                  ? "bg-[#0d1117]"
                  : "border-[#1f2937] hover:border-[#374151]"
              }`}
              style={
                selectedChord.id === p.id
                  ? { borderColor: p.color }
                  : undefined
              }
            >
              <p className="text-sm font-bold" style={{ color: p.color }}>
                {p.label}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">
                {p.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="obe-surface">
        <h3 className="font-bold text-white text-sm mb-3">Acordes Solfeggio</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {SOLFEGGIO_CHORDS.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedChord(p)}
              className={`p-3 rounded-lg border text-left transition-all ${
                selectedChord.id === p.id
                  ? "bg-[#0d1117]"
                  : "border-[#1f2937] hover:border-[#374151]"
              }`}
              style={
                selectedChord.id === p.id
                  ? { borderColor: p.color }
                  : undefined
              }
            >
              <p className="text-sm font-bold" style={{ color: p.color }}>
                {p.label}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">
                {p.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
