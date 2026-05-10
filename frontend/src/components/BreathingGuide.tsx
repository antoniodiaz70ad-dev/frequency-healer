"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  cycles?: number;
  onComplete: () => void;
  onCancel?: () => void;
}

type Phase = "inhale" | "hold" | "exhale" | "rest";

const PHASE_DURATION_MS: Record<Phase, number> = {
  inhale: 4000,
  hold: 7000,
  exhale: 8000,
  rest: 1000,
};

const PHASE_LABEL: Record<Phase, string> = {
  inhale: "Inhala",
  hold: "Sostén",
  exhale: "Exhala",
  rest: "Pausa",
};

const PHASE_COLOR: Record<Phase, string> = {
  inhale: "#60a5fa",
  hold: "#a78bfa",
  exhale: "#4ade80",
  rest: "#374151",
};

const NEXT_PHASE: Record<Phase, Phase> = {
  inhale: "hold",
  hold: "exhale",
  exhale: "rest",
  rest: "inhale",
};

export default function BreathingGuide({
  cycles = 4,
  onComplete,
  onCancel,
}: Props) {
  const [phase, setPhase] = useState<Phase>("inhale");
  const [cyclesDone, setCyclesDone] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(
    Math.ceil(PHASE_DURATION_MS.inhale / 1000)
  );
  const phaseStartRef = useRef<number>(0);
  const completedRef = useRef(false);

  useEffect(() => {
    phaseStartRef.current = Date.now();

    const tickInterval = setInterval(() => {
      const elapsed = Date.now() - phaseStartRef.current;
      const remaining = Math.max(
        0,
        Math.ceil((PHASE_DURATION_MS[phase] - elapsed) / 1000)
      );
      setSecondsLeft(remaining);
    }, 100);

    const phaseTimeout = setTimeout(() => {
      const next = NEXT_PHASE[phase];
      if (next === "inhale") {
        const newCount = cyclesDone + 1;
        setCyclesDone(newCount);
        if (newCount >= cycles) {
          completedRef.current = true;
          onComplete();
          return;
        }
      }
      setPhase(next);
    }, PHASE_DURATION_MS[phase]);

    return () => {
      clearInterval(tickInterval);
      clearTimeout(phaseTimeout);
    };
  }, [phase, cyclesDone, cycles, onComplete]);

  const phaseDuration = PHASE_DURATION_MS[phase];
  const totalSeconds = Math.ceil(phaseDuration / 1000);
  const progress = Math.min(1, 1 - secondsLeft / totalSeconds);

  const scale =
    phase === "inhale"
      ? 0.6 + 0.4 * progress
      : phase === "exhale"
      ? 1.0 - 0.4 * progress
      : phase === "hold"
      ? 1.0
      : 0.6;

  const color = PHASE_COLOR[phase];

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="relative w-64 h-64 flex items-center justify-center">
        <div
          className="absolute rounded-full transition-transform"
          style={{
            width: 240,
            height: 240,
            backgroundColor: color + "10",
            border: `2px solid ${color}40`,
            transform: `scale(${scale})`,
            transitionDuration: `${phaseDuration}ms`,
            transitionTimingFunction:
              phase === "inhale" || phase === "exhale" ? "ease-in-out" : "linear",
          }}
        />
        <div
          className="absolute rounded-full transition-transform"
          style={{
            width: 160,
            height: 160,
            backgroundColor: color + "25",
            border: `1px solid ${color}60`,
            transform: `scale(${scale})`,
            transitionDuration: `${phaseDuration}ms`,
            transitionTimingFunction:
              phase === "inhale" || phase === "exhale" ? "ease-in-out" : "linear",
          }}
        />
        <div className="relative z-10 text-center">
          <p
            className="text-xl font-semibold uppercase tracking-widest"
            style={{ color }}
          >
            {PHASE_LABEL[phase]}
          </p>
          <p className="text-5xl font-bold font-mono text-white mt-2">
            {secondsLeft}
          </p>
        </div>
      </div>

      <div className="mt-8 flex items-center gap-2">
        {Array.from({ length: cycles }).map((_, i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full transition-colors"
            style={{
              backgroundColor: i < cyclesDone ? "#4ade80" : "#1f2937",
            }}
          />
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-3">
        Ciclo {Math.min(cyclesDone + 1, cycles)} de {cycles}
      </p>

      {onCancel && (
        <button
          onClick={onCancel}
          className="mt-6 text-xs text-gray-500 hover:text-white transition-colors"
        >
          Saltar respiración
        </button>
      )}
    </div>
  );
}
