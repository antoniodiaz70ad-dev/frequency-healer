"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PROTOCOLS } from "@/lib/protocols";
import { DOMAIN_INFO, WAVEFORM_INFO } from "@/lib/frequencies";
import { getAudioEngine } from "@/lib/audioEngine";
import { Protocol, ProtocolStep } from "@/lib/types";
import { UI } from "@/lib/constants";

type ProtocolState = "idle" | "playing" | "paused";

export default function ProtocolosPage() {
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null);
  const [protocolState, setProtocolState] = useState<ProtocolState>("idle");
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepElapsed, setStepElapsed] = useState(0);
  const [filterDomain, setFilterDomain] = useState<string>("all");
  const [audioError, setAudioError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepStartRef = useRef<number>(0);
  const pausedElapsedRef = useRef<number>(0);

  const filteredProtocols =
    filterDomain === "all"
      ? PROTOCOLS
      : PROTOCOLS.filter((p) => p.domain.includes(filterDomain as "cuerpo" | "alma" | "espiritu"));

  const totalElapsed = selectedProtocol
    ? selectedProtocol.steps.slice(0, currentStepIndex).reduce((sum, s) => sum + s.durationSeconds, 0) + stepElapsed
    : 0;
  const totalDuration = selectedProtocol
    ? selectedProtocol.steps.reduce((sum, s) => sum + s.durationSeconds, 0)
    : 0;
  const timeRemaining = Math.max(0, totalDuration - totalElapsed);

  const currentStep: ProtocolStep | undefined = selectedProtocol?.steps[currentStepIndex];

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      try { getAudioEngine().stop(); } catch { /* unmounting */ }
    };
  }, []);

  const startStepAudio = useCallback((step: ProtocolStep) => {
    try {
      setAudioError(null);
      const engine = getAudioEngine();
      // Ensure context is active before playing (handles browser suspension)
      engine.ensureRunning().then(() => {
        engine.play(
          step.frequencyHz,
          step.waveform,
          step.volume,
          step.binaural ? { enabled: step.binaural.enabled, differenceHz: step.binaural.differenceHz } : undefined
        );
      });
    } catch {
      setAudioError("No se pudo reproducir el audio. Verifica tu dispositivo de sonido.");
    }
  }, []);

  // Re-engage audio when user returns to tab (browser suspends AudioContext in background)
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && protocolState === "playing" && currentStep) {
        const engine = getAudioEngine();
        engine.ensureRunning().then(() => {
          // If engine reports not playing (browser killed oscillators), restart current step
          if (!engine.getIsPlaying()) {
            startStepAudio(currentStep);
          }
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [protocolState, currentStep, startStepAudio]);

  const advanceStep = useCallback(() => {
    if (!selectedProtocol) return;
    const nextIndex = currentStepIndex + 1;
    if (nextIndex >= selectedProtocol.steps.length) {
      try { getAudioEngine().stop(); } catch { /* completed */ }
      setProtocolState("idle");
      setCurrentStepIndex(0);
      setStepElapsed(0);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    setCurrentStepIndex(nextIndex);
    setStepElapsed(0);
    pausedElapsedRef.current = 0;
    stepStartRef.current = Date.now();
    startStepAudio(selectedProtocol.steps[nextIndex]);
  }, [selectedProtocol, currentStepIndex, startStepAudio]);

  // Timer tick — with AudioContext health check
  useEffect(() => {
    if (protocolState !== "playing" || !currentStep) return;

    timerRef.current = setInterval(() => {
      const elapsed = pausedElapsedRef.current + (Date.now() - stepStartRef.current) / 1000;
      setStepElapsed(elapsed);

      // Health check: if AudioContext was suspended by browser, resume it
      const engine = getAudioEngine();
      if (!engine.isContextActive() && engine.getIsPlaying()) {
        engine.ensureRunning();
      }

      if (elapsed >= currentStep.durationSeconds) {
        advanceStep();
      }
    }, UI.TIMER_INTERVAL_MS);

    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [protocolState, currentStep, advanceStep]);

  const handlePlay = () => {
    if (!selectedProtocol) return;
    if (protocolState === "idle") {
      setCurrentStepIndex(0);
      setStepElapsed(0);
      pausedElapsedRef.current = 0;
      stepStartRef.current = Date.now();
      startStepAudio(selectedProtocol.steps[0]);
      setProtocolState("playing");
    } else if (protocolState === "paused") {
      stepStartRef.current = Date.now();
      if (currentStep) startStepAudio(currentStep);
      setProtocolState("playing");
    }
  };

  const handlePause = () => {
    if (protocolState === "playing") {
      pausedElapsedRef.current += (Date.now() - stepStartRef.current) / 1000;
      try { getAudioEngine().stop(); } catch { /* pausing */ }
      setProtocolState("paused");
    }
  };

  const handleStop = () => {
    try { getAudioEngine().stop(); } catch { /* stopping */ }
    setProtocolState("idle");
    setCurrentStepIndex(0);
    setStepElapsed(0);
    pausedElapsedRef.current = 0;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="max-w-4xl animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Protocolos de Sanación</h1>
        <p className="text-sm text-gray-400">Secuencias automatizadas de frecuencias terapéuticas.</p>
      </div>

      {audioError && (
        <div className="mb-4 p-3 rounded-lg bg-[#f8717115] border border-[#f87171] text-sm text-[#f87171]" role="alert">
          {audioError}
        </div>
      )}

      {/* Domain filter */}
      <div className="flex gap-2 mb-6 flex-wrap" role="radiogroup" aria-label="Filtrar por dominio">
        <button
          onClick={() => setFilterDomain("all")}
          className={`text-xs px-4 py-2 rounded-full border transition-all ${filterDomain === "all" ? "border-[#60a5fa] bg-[#60a5fa15] text-[#60a5fa]" : "border-[#1f2937] text-gray-500 hover:text-white"}`}
          role="radio"
          aria-checked={filterDomain === "all"}
        >
          Todos
        </button>
        {(["cuerpo", "alma", "espiritu"] as const).map((d) => (
          <button
            key={d}
            onClick={() => setFilterDomain(d)}
            className="text-xs px-4 py-2 rounded-full border transition-all"
            style={filterDomain === d ? { color: DOMAIN_INFO[d].color, borderColor: DOMAIN_INFO[d].color, backgroundColor: DOMAIN_INFO[d].color + "15" } : { borderColor: "#1f2937", color: "#6b7280" }}
            role="radio"
            aria-checked={filterDomain === d}
          >
            <span aria-hidden="true">{DOMAIN_INFO[d].icon}</span> {DOMAIN_INFO[d].label}
          </button>
        ))}
      </div>

      {/* Active protocol player */}
      {selectedProtocol && protocolState !== "idle" && (
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Reproduciendo</p>
              <h3 className="text-lg font-bold text-white">
                <span aria-hidden="true">{selectedProtocol.icon}</span> {selectedProtocol.name}
              </h3>
            </div>
            <div className="text-right">
              <p className="text-2xl font-mono font-bold text-[#60a5fa]">{formatTime(totalElapsed)}</p>
              <p className="text-xs text-gray-500">/ {formatTime(totalDuration)}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">Restante: {formatTime(timeRemaining)}</p>
            </div>
          </div>

          {/* Global progress bar */}
          <div className="w-full bg-[#1f2937] rounded-full h-2 mb-4" role="progressbar" aria-valuenow={totalElapsed} aria-valuemin={0} aria-valuemax={totalDuration} aria-label="Progreso del protocolo">
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${totalDuration > 0 ? (totalElapsed / totalDuration) * 100 : 0}%`,
                backgroundColor: selectedProtocol.color,
              }}
            />
          </div>

          {/* Current step info */}
          {currentStep && (
            <div className="flex items-center gap-4 p-3 rounded-lg bg-[#0d1117] border border-[#1f2937] mb-4">
              <div className="flex-1">
                <p className="text-sm text-white font-medium">
                  Paso {currentStepIndex + 1}/{selectedProtocol.steps.length}: {currentStep.frequencyHz} Hz
                </p>
                <p className="text-xs text-gray-400">
                  {WAVEFORM_INFO[currentStep.waveform].label}
                  {currentStep.binaural?.enabled && ` + Binaural ${currentStep.binaural.differenceHz} Hz`}
                  {" "}· Vol {Math.round(currentStep.volume * 100)}%
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono text-[#60a5fa]">
                  {formatTime(stepElapsed)} / {formatTime(currentStep.durationSeconds)}
                </p>
              </div>
            </div>
          )}

          {/* Step indicators */}
          <div className="flex gap-1 mb-4">
            {selectedProtocol.steps.map((_, i) => (
              <div
                key={i}
                className="flex-1 h-1.5 rounded-full transition-all"
                style={{
                  backgroundColor: i < currentStepIndex ? selectedProtocol.color : i === currentStepIndex ? selectedProtocol.color + "80" : "#1f2937",
                }}
              />
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handleStop}
              className="w-12 h-12 rounded-full bg-[#374151] hover:bg-[#4b5563] text-white flex items-center justify-center text-lg transition-all"
              aria-label="Detener protocolo"
            >
              ■
            </button>
            {protocolState === "playing" ? (
              <button
                onClick={handlePause}
                className="w-16 h-16 rounded-full bg-[#fbbf24] hover:bg-[#f59e0b] text-black flex items-center justify-center text-2xl transition-all hover:scale-105"
                aria-label="Pausar protocolo"
              >
                ⏸
              </button>
            ) : (
              <button
                onClick={handlePlay}
                className="w-16 h-16 rounded-full bg-[#60a5fa] hover:bg-[#3b82f6] text-white flex items-center justify-center text-2xl transition-all hover:scale-105 glow-active"
                aria-label="Reanudar protocolo"
              >
                ▶
              </button>
            )}
          </div>
        </div>
      )}

      {/* Protocol cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredProtocols.map((protocol) => {
          const isSelected = selectedProtocol?.id === protocol.id;
          const isActive = isSelected && protocolState !== "idle";
          return (
            <div
              key={protocol.id}
              className={`bg-[#111827] border rounded-xl p-5 transition-all cursor-pointer hover:border-[#374151] ${isActive ? "border-[#60a5fa] ring-1 ring-[#60a5fa30]" : "border-[#1f2937]"}`}
              onClick={() => {
                if (protocolState !== "idle" && selectedProtocol?.id !== protocol.id) {
                  handleStop();
                }
                setSelectedProtocol(protocol);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (protocolState !== "idle" && selectedProtocol?.id !== protocol.id) handleStop();
                  setSelectedProtocol(protocol);
                }
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl" aria-hidden="true">{protocol.icon}</span>
                  <div>
                    <h3 className="text-sm font-bold text-white">{protocol.name}</h3>
                    <p className="text-xs text-gray-500">{protocol.totalDurationMinutes} min · {protocol.steps.length} pasos</p>
                  </div>
                </div>
                {!isActive && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (protocolState !== "idle") handleStop();
                      setSelectedProtocol(protocol);
                      setTimeout(() => {
                        setCurrentStepIndex(0);
                        setStepElapsed(0);
                        pausedElapsedRef.current = 0;
                        stepStartRef.current = Date.now();
                        startStepAudio(protocol.steps[0]);
                        setProtocolState("playing");
                      }, 100);
                    }}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg transition-all hover:scale-110"
                    style={{ backgroundColor: protocol.color }}
                    aria-label={`Reproducir ${protocol.name}`}
                  >
                    ▶
                  </button>
                )}
              </div>

              <p className="text-xs text-gray-400 mb-3 line-clamp-2">{protocol.description}</p>

              <div className="flex gap-1.5 mb-3">
                {protocol.domain.map((d) => (
                  <span
                    key={d}
                    className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: DOMAIN_INFO[d].color + "20", color: DOMAIN_INFO[d].color }}
                  >
                    <span aria-hidden="true">{DOMAIN_INFO[d].icon}</span> {DOMAIN_INFO[d].label}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-1">
                {protocol.steps.map((step, i) => (
                  <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#0d1117] text-gray-500 border border-[#1f293750]">
                    {step.frequencyHz} Hz
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
