"use client";

import { useState } from "react";
import { OBESessionLog, VisualClarity } from "@/lib/types";
import { newSessionId, todayISO } from "@/lib/sessionLog";

interface Props {
  onSubmit: (log: OBESessionLog) => void;
  onCancel: () => void;
  initialFocusLabel?: string;
  initialDuration?: number;
  initialIntention?: string;
}

const CLARITY_OPTIONS: { value: VisualClarity; label: string; color: string }[] = [
  { value: "none", label: "No salí / oscuro", color: "#6b7280" },
  { value: "partial", label: "Borroso o parcial", color: "#fbbf24" },
  { value: "full", label: "Cristalino", color: "#4ade80" },
];

export default function SessionLogForm({
  onSubmit,
  onCancel,
  initialFocusLabel = "",
  initialDuration = 30,
  initialIntention = "",
}: Props) {
  const [focusLabel, setFocusLabel] = useState(initialFocusLabel);
  const [durationMinutes, setDurationMinutes] = useState(initialDuration);
  const [paralysisAchieved, setParalysisAchieved] = useState(false);
  const [vibrations, setVibrations] = useState(false);
  const [separation, setSeparation] = useState(false);
  const [visualClarity, setVisualClarity] = useState<VisualClarity>("none");
  const [lookedBack, setLookedBack] = useState(false);
  const [preEnergy, setPreEnergy] = useState(7);
  const [postEnergy, setPostEnergy] = useState(7);
  const [intention, setIntention] = useState(initialIntention);
  const [notes, setNotes] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const submit = () => {
    const log: OBESessionLog = {
      id: newSessionId(),
      createdAt: Date.now(),
      sessionDate: todayISO(),
      focusLabel: focusLabel.trim() || "Sin etiquetar",
      durationMinutes,
      paralysisAchieved,
      vibrations,
      separation,
      visualClarity,
      lookedBack,
      preEnergy,
      postEnergy,
      intention: intention.trim() || undefined,
      notes: notes.trim(),
      tags: tagsInput
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    };
    onSubmit(log);
  };

  return (
    <div className="space-y-4">
      {/* Header info */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-5 space-y-3">
        <p className="text-[10px] uppercase tracking-widest text-gray-500">
          Sesión registrada
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label>
            <p className="text-xs text-gray-400 mb-1">Etiqueta / nivel</p>
            <input
              type="text"
              value={focusLabel}
              onChange={(e) => setFocusLabel(e.target.value)}
              placeholder="Focus 10, 369 Hz Tesla..."
              className="w-full bg-[#0d1117] border border-[#1f2937] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#60a5fa] transition-colors"
            />
          </label>
          <label>
            <p className="text-xs text-gray-400 mb-1">Duración (min)</p>
            <input
              type="number"
              min={1}
              max={300}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full bg-[#0d1117] border border-[#1f2937] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#60a5fa] transition-colors"
            />
          </label>
        </div>
      </div>

      {/* Markers */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-5 space-y-3">
        <p className="text-[10px] uppercase tracking-widest text-gray-500">
          Marcadores fenomenológicos
        </p>

        <ToggleRow
          label="Parálisis del sueño alcanzada"
          checked={paralysisAchieved}
          onChange={setParalysisAchieved}
        />
        <ToggleRow
          label="Vibraciones / hormigueo / electricidad"
          checked={vibrations}
          onChange={setVibrations}
        />
        <ToggleRow
          label="Separación del cuerpo (rodar, sentarse, despegar)"
          checked={separation}
          onChange={setSeparation}
        />
        <ToggleRow
          label="Miré hacia mi cuerpo (snap-back)"
          checked={lookedBack}
          onChange={setLookedBack}
        />

        <div>
          <p className="text-xs text-gray-400 mb-2">Claridad visual fuera</p>
          <div className="flex gap-2 flex-wrap">
            {CLARITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setVisualClarity(opt.value)}
                className="text-xs px-3 py-1.5 rounded-lg border transition-all"
                style={
                  visualClarity === opt.value
                    ? {
                        color: opt.color,
                        borderColor: opt.color,
                        backgroundColor: opt.color + "15",
                      }
                    : { borderColor: "#1f2937", color: "#6b7280" }
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Energy */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-5 space-y-4">
        <p className="text-[10px] uppercase tracking-widest text-gray-500">
          Energía (1-10)
        </p>
        <EnergySlider
          label="Antes de la sesión"
          value={preEnergy}
          onChange={setPreEnergy}
        />
        <EnergySlider
          label="Después / al despertar"
          value={postEnergy}
          onChange={setPostEnergy}
        />
        {postEnergy <= 3 && (
          <div className="bg-[#f8717115] border border-[#f8717140] rounded-lg p-3">
            <p className="text-xs text-[#f87171]">
              ⚠️ Energía baja registrada. El sistema activará una recomendación
              de descanso de 7 días para prevenir burnout.
            </p>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-5 space-y-3">
        <p className="text-[10px] uppercase tracking-widest text-gray-500">
          Registro narrativo
        </p>

        <label>
          <p className="text-xs text-gray-400 mb-1">Intención que declaraste</p>
          <input
            type="text"
            value={intention}
            onChange={(e) => setIntention(e.target.value)}
            placeholder="Tengo la intención de..."
            className="w-full bg-[#0d1117] border border-[#1f2937] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#60a5fa] transition-colors"
          />
        </label>

        <label>
          <p className="text-xs text-gray-400 mb-1">
            Notas (lo que recuerdes, sensaciones, presencias, lugares)
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            placeholder="Escribe ahora antes de que la memoria del estado disociado se evapore..."
            className="w-full bg-[#0d1117] border border-[#1f2937] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#60a5fa] transition-colors resize-none"
          />
        </label>

        <label>
          <p className="text-xs text-gray-400 mb-1">
            Tags (separados por coma)
          </p>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="vibraciones, claridad, guia, sanación..."
            className="w-full bg-[#0d1117] border border-[#1f2937] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#60a5fa] transition-colors"
          />
        </label>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onCancel}
          className="py-3 bg-[#0d1117] border border-[#1f2937] hover:border-[#374151] text-gray-400 hover:text-white text-sm rounded-xl transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={submit}
          className="py-3 bg-[#60a5fa] hover:bg-[#3b82f6] text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Guardar registro
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-3 py-2 text-left"
    >
      <span className="text-sm text-gray-300">{label}</span>
      <span
        className={`w-10 h-5 rounded-full flex-shrink-0 transition-colors ${
          checked ? "bg-[#4ade80]" : "bg-[#374151]"
        }`}
      >
        <span
          className={`block w-4 h-4 rounded-full bg-white transition-transform mt-0.5 ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function EnergySlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const color = value <= 3 ? "#f87171" : value <= 5 ? "#fbbf24" : "#4ade80";
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <p className="text-xs text-gray-400">{label}</p>
        <p
          className="text-xl font-mono font-bold"
          style={{ color }}
        >
          {value}<span className="text-xs text-gray-500">/10</span>
        </p>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      <div className="flex justify-between text-[9px] text-gray-600 mt-1">
        <span>Drenado</span>
        <span>Neutral</span>
        <span>Cargado</span>
      </div>
    </div>
  );
}
