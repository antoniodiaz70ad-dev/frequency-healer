"use client";

import { useState } from "react";
import { OBESessionLog } from "@/lib/types";

interface Props {
  log: OBESessionLog;
  onDelete: (id: string) => void;
}

const CLARITY_LABEL: Record<string, { label: string; color: string }> = {
  none: { label: "Sin claridad", color: "#6b7280" },
  partial: { label: "Parcial", color: "#fbbf24" },
  full: { label: "Cristalina", color: "#4ade80" },
};

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function SessionLogItem({ log, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const clarity = CLARITY_LABEL[log.visualClarity];
  const energyDelta = log.postEnergy - log.preEnergy;
  const energyColor =
    log.postEnergy <= 3
      ? "#f87171"
      : log.postEnergy <= 5
      ? "#fbbf24"
      : "#4ade80";

  return (
    <div
      className={`bg-[#111827] border rounded-xl transition-all overflow-hidden ${
        expanded
          ? "border-[#60a5fa] ring-1 ring-[#60a5fa30]"
          : "border-[#1f2937] hover:border-[#374151]"
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left flex items-start gap-3"
      >
        <div className="w-12 flex-shrink-0 text-center">
          <p className="text-[10px] text-gray-600 uppercase">
            {formatDate(log.sessionDate)}
          </p>
          <p
            className="text-2xl font-mono font-bold mt-0.5"
            style={{ color: energyColor }}
          >
            {log.postEnergy}
          </p>
          <p className="text-[9px] text-gray-600">/10</p>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white">{log.focusLabel}</p>
            <span className="text-xs text-gray-500">
              {log.durationMinutes} min
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {log.paralysisAchieved && (
              <Badge label="Parálisis" color="#a78bfa" />
            )}
            {log.vibrations && <Badge label="Vibraciones" color="#67e8f9" />}
            {log.separation && <Badge label="Separación" color="#fbbf24" />}
            <Badge label={clarity.label} color={clarity.color} />
            {log.lookedBack && <Badge label="Snap-back" color="#f87171" />}
          </div>
        </div>

        <span
          className={`text-gray-600 transition-transform flex-shrink-0 mt-2 ${
            expanded ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-[#1f2937] pt-3 space-y-3">
          {log.intention && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">
                Intención
              </p>
              <p className="text-sm text-gray-300 italic">“{log.intention}”</p>
            </div>
          )}

          {log.notes && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">
                Notas
              </p>
              <p className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">
                {log.notes}
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">
                Pre energía
              </p>
              <p className="text-sm font-mono text-white">{log.preEnergy}/10</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">
                Post energía
              </p>
              <p
                className="text-sm font-mono"
                style={{ color: energyColor }}
              >
                {log.postEnergy}/10
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">
                Δ
              </p>
              <p
                className="text-sm font-mono"
                style={{
                  color:
                    energyDelta > 0
                      ? "#4ade80"
                      : energyDelta < 0
                      ? "#f87171"
                      : "#9ca3af",
                }}
              >
                {energyDelta > 0 ? "+" : ""}
                {energyDelta}
              </p>
            </div>
          </div>

          {log.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {log.tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] px-2 py-0.5 rounded bg-[#0d1117] text-gray-500 border border-[#1f293750]"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}

          <button
            onClick={() => {
              if (confirm("¿Eliminar este registro? No se puede deshacer.")) {
                onDelete(log.id);
              }
            }}
            className="text-xs text-[#f87171] hover:text-[#ef4444] transition-colors mt-2"
          >
            Eliminar registro
          </button>
        </div>
      )}
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full"
      style={{ backgroundColor: color + "20", color }}
    >
      {label}
    </span>
  );
}
