"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Waveform, OutputMode, FrequencyPreset } from "@/lib/types";
import { getAudioEngine, AudioEngine } from "@/lib/audioEngine";
import { FREQUENCY_DATABASE, WAVEFORM_INFO, DOMAIN_INFO } from "@/lib/frequencies";
import { AUDIO, UI } from "@/lib/constants";
import AudioVisualizer from "@/components/AudioVisualizer";

const PRESETS: FrequencyPreset[] = [
  { label: "528 Hz Milagro", hz: 528, waveform: "sine", color: "#fbbf24" },
  { label: "432 Hz Natural", hz: 432, waveform: "sine", color: "#4ade80" },
  { label: "40 Hz Gamma", hz: 40, waveform: "sine", color: "#60a5fa" },
  { label: "7.83 Hz Schumann", hz: 7.83, waveform: "sine", color: "#a78bfa" },
  { label: "174 Hz Dolor", hz: 174, waveform: "sine", color: "#f87171" },
  { label: "963 Hz Corona", hz: 963, waveform: "sine", color: "#67e8f9" },
  { label: "727 Hz Rife", hz: 727, waveform: "square", color: "#f87171" },
  { label: "880 Hz Inmune", hz: 880, waveform: "square", color: "#fb923c" },
];

export default function GeneradorPage() {
  const [frequency, setFrequency] = useState<number>(AUDIO.DEFAULT_FREQUENCY_HZ);
  const [waveform, setWaveform] = useState<Waveform>("sine");
  const [volume, setVolume] = useState(50);
  const [isPlaying, setIsPlaying] = useState(false);
  const [outputMode, setOutputMode] = useState<OutputMode>("speakers");
  const [tuning432, setTuning432] = useState(false);
  const [binaural, setBinaural] = useState(false);
  const [binauralDiff, setBinauralDiff] = useState(10);
  const [dwellTime, setDwellTime] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveFreq = useMemo(
    () => tuning432 ? AudioEngine.to432(frequency) : frequency,
    [frequency, tuning432]
  );

  const freqInfo = useMemo(
    () => FREQUENCY_DATABASE.find((f) => Math.abs(f.hz - frequency) < UI.FREQUENCY_MATCH_THRESHOLD_HZ),
    [frequency]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
      try { getAudioEngine().stop(); } catch { /* unmounting */ }
    };
  }, []);

  const handlePlay = useCallback(() => {
    try {
      setAudioError(null);
      const engine = getAudioEngine();
      engine.setOutputMode(outputMode);
      engine.play(effectiveFreq, waveform, volume / 100, {
        enabled: binaural,
        differenceHz: binauralDiff,
      });
      setIsPlaying(true);

      if (dwellTime > 0) {
        dwellTimerRef.current = setTimeout(() => {
          engine.stop();
          setIsPlaying(false);
          dwellTimerRef.current = null;
        }, dwellTime * 1000);
      }
    } catch {
      setAudioError("No se pudo iniciar el audio. Verifica que tu dispositivo tenga salida de sonido.");
    }
  }, [effectiveFreq, waveform, volume, outputMode, binaural, binauralDiff, dwellTime]);

  const handleStop = useCallback(() => {
    try { getAudioEngine().stop(); } catch { /* already stopped */ }
    setIsPlaying(false);
    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
  }, []);

  const applyPreset = (hz: number, wf: Waveform) => {
    setFrequency(hz);
    setWaveform(wf);
    if (isPlaying) handleStop();
  };

  const clampFrequency = (value: number) =>
    Math.max(AUDIO.MIN_FREQUENCY_HZ, Math.min(AUDIO.MAX_FREQUENCY_HZ, value));

  return (
    <div className="max-w-4xl animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Generador de Tonos</h1>
        <p className="text-sm text-gray-400">Genera frecuencias precisas para bocinas o bobinas electromagnéticas.</p>
      </div>

      {audioError && (
        <div className="mb-4 p-3 rounded-lg bg-[#f8717115] border border-[#f87171] text-sm text-[#f87171]" role="alert">
          {audioError}
        </div>
      )}

      <div className="mb-6">
        <AudioVisualizer isPlaying={isPlaying} color={freqInfo ? DOMAIN_INFO[freqInfo.domain[0]]?.color : "#60a5fa"} />
      </div>

      {/* Main frequency display */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-6 mb-6 text-center">
        <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Frecuencia</p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setFrequency((f) => clampFrequency(f - 1))}
            className="text-gray-500 hover:text-white text-2xl w-10 h-10 rounded-full border border-[#1f2937] flex items-center justify-center"
            aria-label="Disminuir frecuencia"
          >
            −
          </button>
          <input
            type="number"
            value={frequency}
            onChange={(e) => setFrequency(clampFrequency(Number(e.target.value)))}
            className="bg-transparent text-5xl md:text-6xl font-bold font-mono text-[#60a5fa] text-center w-48 md:w-64 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            step="0.01"
            min={AUDIO.MIN_FREQUENCY_HZ}
            max={AUDIO.MAX_FREQUENCY_HZ}
            aria-label="Frecuencia en Hz"
          />
          <button
            onClick={() => setFrequency((f) => clampFrequency(f + 1))}
            className="text-gray-500 hover:text-white text-2xl w-10 h-10 rounded-full border border-[#1f2937] flex items-center justify-center"
            aria-label="Aumentar frecuencia"
          >
            +
          </button>
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
            min={AUDIO.MIN_FREQUENCY_HZ}
            max={2000}
            step={0.1}
            value={Math.min(frequency, 2000)}
            onChange={(e) => setFrequency(Number(e.target.value))}
            className="w-full"
            aria-label="Selector de frecuencia"
          />
          <div className="flex justify-between text-[9px] text-gray-600 mt-1">
            <span>0.1 Hz</span><span>500</span><span>1000</span><span>1500</span><span>2000 Hz</span>
          </div>
        </div>
      </div>

      {/* Controls grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Waveform */}
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Forma de Onda</p>
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Forma de onda">
            {(["sine", "square", "triangle", "sawtooth"] as Waveform[]).map((w) => (
              <button
                key={w}
                onClick={() => setWaveform(w)}
                className={`p-2 rounded-lg border text-center text-xs transition-all ${waveform === w ? "border-[#60a5fa] bg-[#60a5fa15] text-[#60a5fa]" : "border-[#1f2937] text-gray-500 hover:text-white"}`}
                role="radio"
                aria-checked={waveform === w}
              >
                <span className="text-lg block" aria-hidden="true">{WAVEFORM_INFO[w].icon}</span>
                {WAVEFORM_INFO[w].label}
              </button>
            ))}
          </div>
        </div>

        {/* Volume */}
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Volumen: {volume}%</p>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => {
              const v = Number(e.target.value);
              setVolume(v);
              if (isPlaying) getAudioEngine().setVolume(v / 100);
            }}
            className="w-full"
            aria-label="Volumen"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={volume}
          />
          <div className="flex justify-between text-[9px] text-gray-600 mt-1">
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
        </div>

        {/* Binaural */}
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Binaural Beats</p>
            <button
              onClick={() => setBinaural(!binaural)}
              className={`w-10 h-5 rounded-full transition-colors ${binaural ? "bg-[#60a5fa]" : "bg-[#374151]"}`}
              role="switch"
              aria-checked={binaural}
              aria-label="Activar beats binaurales"
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${binaural ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
          {binaural && (
            <div>
              <p className="text-xs text-gray-400 mb-1">
                Diferencia: {binauralDiff} Hz (
                {binauralDiff <= 4 ? "Delta" : binauralDiff <= 8 ? "Theta" : binauralDiff <= 14 ? "Alpha" : binauralDiff <= 30 ? "Beta" : "Gamma"})
              </p>
              <input
                type="range"
                min={AUDIO.BINAURAL_MIN_DIFF_HZ}
                max={AUDIO.BINAURAL_MAX_DIFF_HZ}
                step={0.5}
                value={binauralDiff}
                onChange={(e) => setBinauralDiff(Number(e.target.value))}
                className="w-full"
                aria-label="Frecuencia de diferencia binaural"
              />
              <p className="text-[10px] text-gray-600 mt-1">Usa audífonos para efecto binaural</p>
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">Salida</p>
            <div className="flex gap-1 bg-[#0d1117] rounded-lg p-0.5" role="radiogroup" aria-label="Modo de salida">
              <button
                onClick={() => setOutputMode("speakers")}
                className={`text-xs px-3 py-1 rounded-md ${outputMode === "speakers" ? "bg-[#1f2937] text-white" : "text-gray-500"}`}
                role="radio"
                aria-checked={outputMode === "speakers"}
              >
                <span aria-hidden="true">🔊</span> Bocinas
              </button>
              <button
                onClick={() => setOutputMode("coils")}
                className={`text-xs px-3 py-1 rounded-md ${outputMode === "coils" ? "bg-[#1f2937] text-white" : "text-gray-500"}`}
                role="radio"
                aria-checked={outputMode === "coils"}
              >
                <span aria-hidden="true">🧲</span> Bobinas
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">Afinación 432 Hz</p>
            <button
              onClick={() => setTuning432(!tuning432)}
              className={`w-10 h-5 rounded-full transition-colors ${tuning432 ? "bg-[#4ade80]" : "bg-[#374151]"}`}
              role="switch"
              aria-checked={tuning432}
              aria-label="Activar afinación 432 Hz"
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${tuning432 ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">Temporizador</p>
            <select
              value={dwellTime}
              onChange={(e) => setDwellTime(Number(e.target.value))}
              className="bg-[#0d1117] border border-[#1f2937] rounded-md text-xs text-white px-2 py-1"
              aria-label="Temporizador de apagado automático"
            >
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

      {/* Play / Stop */}
      <div className="flex justify-center mb-8">
        {!isPlaying ? (
          <button
            onClick={handlePlay}
            className="w-20 h-20 rounded-full bg-[#60a5fa] hover:bg-[#3b82f6] text-white flex items-center justify-center text-3xl transition-all hover:scale-105 glow-active"
            aria-label="Reproducir tono"
          >
            ▶
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="w-20 h-20 rounded-full bg-[#f87171] hover:bg-[#ef4444] text-white flex items-center justify-center text-2xl transition-all hover:scale-105"
            aria-label="Detener tono"
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
    </div>
  );
}
