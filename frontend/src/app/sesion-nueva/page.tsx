"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import BreathingGuide from "@/components/BreathingGuide";
import { downloadICS } from "@/lib/icsAlarm";

type Step = "config" | "schedule" | "breathe" | "intention" | "ready";

interface FocusPreset {
  id: string;
  label: string;
  description: string;
  color: string;
  defaultMinutes: number;
}

const FOCUS_PRESETS: FocusPreset[] = [
  {
    id: "f10",
    label: "Focus 10",
    description: "Mente despierta, cuerpo dormido",
    color: "#a78bfa",
    defaultMinutes: 30,
  },
  {
    id: "f12",
    label: "Focus 12",
    description: "Conciencia expandida (+ alfa)",
    color: "#67e8f9",
    defaultMinutes: 30,
  },
  {
    id: "f15",
    label: "Focus 15",
    description: "El no-tiempo (vacío theta alta)",
    color: "#818cf8",
    defaultMinutes: 45,
  },
  {
    id: "f21",
    label: "Focus 21",
    description: "El puente (delta + theta + alfa)",
    color: "#c084fc",
    defaultMinutes: 45,
  },
];

const DURATIONS = [15, 30, 45, 60, 90, 180];

const DEFAULT_INTENTION =
  "Tengo la intención de estar fuera de mi cuerpo con completa conciencia.";

const SESSION_CONFIG_KEY = "fh:next-session-config-v1";

function todayAt(hours: number, minutes: number): Date {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function tomorrowAt(hours: number, minutes: number): Date {
  const d = todayAt(hours, minutes);
  d.setDate(d.getDate() + 1);
  return d;
}

function nextSessionDate(hh: number, mm: number): Date {
  const today = todayAt(hh, mm);
  return today.getTime() > Date.now() ? today : tomorrowAt(hh, mm);
}

export default function SesionNuevaPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("config");

  const [focusId, setFocusId] = useState(FOCUS_PRESETS[0].id);
  const [duration, setDuration] = useState(30);
  const [wbtbHour, setWbtbHour] = useState("03:00");
  const [intention, setIntention] = useState(DEFAULT_INTENTION);

  const focus = useMemo(
    () => FOCUS_PRESETS.find((p) => p.id === focusId) ?? FOCUS_PRESETS[0],
    [focusId]
  );

  const handleSelectFocus = useCallback((id: string) => {
    setFocusId(id);
    const preset = FOCUS_PRESETS.find((p) => p.id === id);
    if (preset) setDuration(preset.defaultMinutes);
  }, []);

  const persistAndLaunch = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        SESSION_CONFIG_KEY,
        JSON.stringify({
          focusId,
          duration,
          intention,
          startedAt: Date.now(),
        })
      );
    }
    router.push(`/generador?focus=${focusId}&duration=${duration}`);
  }, [focusId, duration, intention, router]);

  const downloadAlarm = useCallback(() => {
    const [hh, mm] = wbtbHour.split(":").map(Number);
    const startsAt = nextSessionDate(hh, mm);
    downloadICS("frequency-healer-wbtb-alarm", {
      title: `Frequency Healer · Sesión ${focus.label}`,
      description: `Alarma WBTB. Despierta tranquilo, ve al baño si lo necesitas, ponte los auriculares estéreo y abre la app en /sesion-nueva.\\n\\nIntención: ${intention}`,
      startsAt,
      durationMinutes: duration,
      reminderMinutesBefore: 0,
    });
  }, [wbtbHour, focus.label, intention, duration]);

  return (
    <div className="max-w-2xl animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Nueva sesión</h1>
        <p className="text-sm text-gray-400">
          Wizard guiado: configurar → programar (opcional) → respirar →
          declarar intención → iniciar.
        </p>
      </div>

      <StepIndicator step={step} />

      {step === "config" && (
        <ConfigStep
          focus={focus}
          duration={duration}
          onFocusChange={handleSelectFocus}
          onDurationChange={setDuration}
          onNext={() => setStep("schedule")}
        />
      )}

      {step === "schedule" && (
        <ScheduleStep
          wbtbHour={wbtbHour}
          onHourChange={setWbtbHour}
          onDownload={downloadAlarm}
          onStartNow={() => setStep("breathe")}
          onBack={() => setStep("config")}
        />
      )}

      {step === "breathe" && (
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-6">
          <div className="text-center mb-2">
            <p className="text-[10px] uppercase tracking-widest text-gray-500">
              Paso 3 · Respiración 4-7-8
            </p>
            <p className="text-xs text-gray-400 mt-1">
              4 ciclos. Inhala 4s · Sostén 7s · Exhala 8s.
            </p>
          </div>
          <BreathingGuide
            cycles={4}
            onComplete={() => setStep("intention")}
            onCancel={() => setStep("intention")}
          />
        </div>
      )}

      {step === "intention" && (
        <IntentionStep
          intention={intention}
          onChange={setIntention}
          onNext={() => setStep("ready")}
          onBack={() => setStep("breathe")}
        />
      )}

      {step === "ready" && (
        <ReadyStep
          focus={focus}
          duration={duration}
          intention={intention}
          onLaunch={persistAndLaunch}
          onBack={() => setStep("intention")}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  const order: Step[] = ["config", "schedule", "breathe", "intention", "ready"];
  const currentIdx = order.indexOf(step);
  const labels: Record<Step, string> = {
    config: "Configurar",
    schedule: "Programar",
    breathe: "Respirar",
    intention: "Intención",
    ready: "Iniciar",
  };

  return (
    <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
      {order.map((s, i) => {
        const active = i === currentIdx;
        const done = i < currentIdx;
        return (
          <div key={s} className="flex items-center gap-2 flex-shrink-0">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                active
                  ? "bg-[#60a5fa] text-white"
                  : done
                  ? "bg-[#4ade80] text-white"
                  : "bg-[#1f2937] text-gray-600"
              }`}
            >
              {done ? "✓" : i + 1}
            </div>
            <span
              className={`text-xs ${
                active ? "text-white" : done ? "text-gray-400" : "text-gray-600"
              }`}
            >
              {labels[s]}
            </span>
            {i < order.length - 1 && (
              <span className="text-gray-700 text-xs">›</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface ConfigStepProps {
  focus: FocusPreset;
  duration: number;
  onFocusChange: (id: string) => void;
  onDurationChange: (n: number) => void;
  onNext: () => void;
}

function ConfigStep({
  focus,
  duration,
  onFocusChange,
  onDurationChange,
  onNext,
}: ConfigStepProps) {
  return (
    <div className="space-y-4">
      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-5">
        <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-3">
          Paso 1 · Nivel de Enfoque
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {FOCUS_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => onFocusChange(p.id)}
              className={`p-3 rounded-lg border text-left transition-all ${
                focus.id === p.id ? "" : "border-[#1f2937] hover:border-[#374151]"
              }`}
              style={
                focus.id === p.id
                  ? { borderColor: p.color, backgroundColor: p.color + "10" }
                  : undefined
              }
            >
              <p
                className="text-sm font-bold"
                style={{ color: p.color }}
              >
                {p.label}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {p.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-5">
        <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-3">
          Duración: {duration} min
        </p>
        <div className="flex flex-wrap gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d}
              onClick={() => onDurationChange(d)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                duration === d
                  ? "border-[#60a5fa] bg-[#60a5fa15] text-[#60a5fa]"
                  : "border-[#1f2937] text-gray-500 hover:text-white"
              }`}
            >
              {d} min
            </button>
          ))}
        </div>
        <p className="text-[10px] text-gray-600 mt-2">
          Las duraciones canónicas son <strong>90 min</strong> (uso nocturno
          regular) y <strong>180 min</strong> (inmersión profunda de fin de
          semana).
        </p>
      </div>

      <button
        onClick={onNext}
        className="w-full py-3 bg-[#60a5fa] hover:bg-[#3b82f6] text-white text-sm font-semibold rounded-xl transition-colors"
      >
        Continuar →
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface ScheduleStepProps {
  wbtbHour: string;
  onHourChange: (s: string) => void;
  onDownload: () => void;
  onStartNow: () => void;
  onBack: () => void;
}

function ScheduleStep({
  wbtbHour,
  onHourChange,
  onDownload,
  onStartNow,
  onBack,
}: ScheduleStepProps) {
  const isLateNight = (() => {
    const hour = new Date().getHours();
    return hour >= 1 && hour <= 5;
  })();

  return (
    <div className="space-y-4">
      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-5">
        <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-3">
          Paso 2 · Programar (opcional)
        </p>

        {isLateNight ? (
          <div className="bg-[#0d1117] border border-[#fbbf2440] rounded-lg p-3 mb-4">
            <p className="text-xs text-[#fbbf24]">
              🌙 Estás en la ventana WBTB ideal (1-5 a.m.). Salta la programación
              y empieza ahora.
            </p>
          </div>
        ) : (
          <div className="bg-[#0d1117] border border-[#1f2937] rounded-lg p-3 mb-4">
            <p className="text-xs text-gray-400">
              <strong className="text-white">WBTB</strong> (Wake-Back-To-Bed):
              duerme 4-6 horas, despierta entre las 2:00 y 3:00 a.m., y entonces
              haz la sesión. Es la ventana de máxima eficiencia.
            </p>
          </div>
        )}

        <label className="block">
          <p className="text-xs text-gray-400 mb-2">Hora de la alarma</p>
          <input
            type="time"
            value={wbtbHour}
            onChange={(e) => onHourChange(e.target.value)}
            className="bg-[#0d1117] border border-[#1f2937] rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-[#60a5fa] transition-colors"
          />
        </label>

        <button
          onClick={onDownload}
          className="mt-4 w-full py-2.5 bg-[#1f2937] hover:bg-[#374151] text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <span>📅</span>
          <span>Descargar alarma .ics</span>
        </button>
        <p className="text-[10px] text-gray-600 mt-2">
          Importa el archivo a tu calendario (iOS Calendar, Google Calendar) y la
          alarma del SO te despertará a la hora programada — mucho más fiable
          que una pestaña abierta.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onBack}
          className="py-3 bg-[#0d1117] border border-[#1f2937] hover:border-[#374151] text-gray-400 hover:text-white text-sm rounded-xl transition-colors"
        >
          ← Atrás
        </button>
        <button
          onClick={onStartNow}
          className="py-3 bg-[#60a5fa] hover:bg-[#3b82f6] text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Empezar ahora →
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface IntentionStepProps {
  intention: string;
  onChange: (s: string) => void;
  onNext: () => void;
  onBack: () => void;
}

function IntentionStep({
  intention,
  onChange,
  onNext,
  onBack,
}: IntentionStepProps) {
  return (
    <div className="space-y-4">
      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-6">
        <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-3">
          Paso 4 · Declaración de intención
        </p>
        <p className="text-sm text-gray-400 mb-4">
          Lee tu intención en voz baja, con autoridad serena. El subconsciente
          actúa por mandato, no por petición. Personalízala si quieres.
        </p>

        <textarea
          value={intention}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="w-full bg-[#0d1117] border border-[#1f2937] rounded-lg px-4 py-3 text-white text-base leading-relaxed focus:outline-none focus:border-[#60a5fa] transition-colors resize-none"
        />

        <div className="mt-4 p-4 bg-[#0d1117] border border-[#60a5fa40] rounded-lg">
          <p className="text-[10px] uppercase tracking-widest text-[#60a5fa] mb-2">
            Tu intención ahora
          </p>
          <p className="text-base text-white italic leading-relaxed">
            “{intention.trim() || "—"}”
          </p>
        </div>

        <button
          onClick={() => onChange(DEFAULT_INTENTION)}
          className="mt-3 text-xs text-gray-500 hover:text-white transition-colors"
        >
          Restaurar texto sugerido
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onBack}
          className="py-3 bg-[#0d1117] border border-[#1f2937] hover:border-[#374151] text-gray-400 hover:text-white text-sm rounded-xl transition-colors"
        >
          ← Atrás
        </button>
        <button
          onClick={onNext}
          disabled={!intention.trim()}
          className="py-3 bg-[#60a5fa] hover:bg-[#3b82f6] disabled:bg-[#1f2937] disabled:text-gray-600 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Continuar →
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface ReadyStepProps {
  focus: FocusPreset;
  duration: number;
  intention: string;
  onLaunch: () => void;
  onBack: () => void;
}

function ReadyStep({
  focus,
  duration,
  intention,
  onLaunch,
  onBack,
}: ReadyStepProps) {
  return (
    <div className="space-y-4">
      <div
        className="border rounded-xl p-6"
        style={{
          backgroundColor: focus.color + "08",
          borderColor: focus.color + "40",
        }}
      >
        <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-3">
          Paso 5 · Listo para iniciar
        </p>

        <div className="space-y-3 mb-6">
          <Row label="Nivel" value={focus.label} color={focus.color} />
          <Row label="Duración" value={`${duration} min`} />
          <Row label="Intención" value={intention} multiline />
        </div>

        <div className="bg-[#0d1117] border border-[#1f2937] rounded-lg p-3 mb-4 space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-gray-500">
            Antes de pulsar iniciar
          </p>
          <ChecklistItem text="Auriculares estéreo conectados" />
          <ChecklistItem text="Antifaz o luz totalmente bloqueada" />
          <ChecklistItem text="Posición boca arriba, sin tensión" />
          <ChecklistItem text="Vejiga vacía, ayuno >60 min" />
          <ChecklistItem text="Móvil en silencio" />
        </div>

        <button
          onClick={onLaunch}
          className="w-full py-4 text-white text-base font-bold rounded-xl transition-all hover:scale-[1.02]"
          style={{ backgroundColor: focus.color }}
        >
          ▶ Iniciar sesión binaural
        </button>
        <p className="text-[10px] text-gray-600 mt-2 text-center">
          Te llevará al generador con el preset preconfigurado.
        </p>
      </div>

      <button
        onClick={onBack}
        className="w-full py-3 bg-[#0d1117] border border-[#1f2937] hover:border-[#374151] text-gray-400 hover:text-white text-sm rounded-xl transition-colors"
      >
        ← Atrás
      </button>
    </div>
  );
}

function Row({
  label,
  value,
  color,
  multiline,
}: {
  label: string;
  value: string;
  color?: string;
  multiline?: boolean;
}) {
  return (
    <div className={multiline ? "" : "flex items-baseline justify-between gap-4"}>
      <p className="text-[10px] uppercase tracking-widest text-gray-500">
        {label}
      </p>
      <p
        className={`${multiline ? "text-sm italic mt-1" : "text-sm font-medium"}`}
        style={{ color: color ?? "#fff" }}
      >
        {value}
      </p>
    </div>
  );
}

function ChecklistItem({ text }: { text: string }) {
  return (
    <p className="text-xs text-gray-300 flex items-start gap-2">
      <span className="text-[#4ade80] flex-shrink-0">✓</span>
      <span>{text}</span>
    </p>
  );
}
