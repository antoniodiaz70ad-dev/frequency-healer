"use client";

import { useState, useEffect, useMemo } from "react";
import { OBESessionLog } from "@/lib/types";
import {
  loadSessionLogs,
  appendSessionLog,
  deleteSessionLog,
  computeCooldown,
  formatRelativeTime,
} from "@/lib/sessionLog";
import SessionLogForm from "@/components/SessionLogForm";
import SessionLogItem from "@/components/SessionLogItem";

type Mode = "list" | "form";

const COOLDOWN_STYLE: Record<
  string,
  { bg: string; border: string; text: string; icon: string }
> = {
  clear: {
    bg: "#4ade8010",
    border: "#4ade8040",
    text: "#4ade80",
    icon: "✓",
  },
  caution: {
    bg: "#fbbf2415",
    border: "#fbbf2440",
    text: "#fbbf24",
    icon: "⚠",
  },
  "rest-required": {
    bg: "#f8717115",
    border: "#f8717140",
    text: "#f87171",
    icon: "⛔",
  },
};

export default function DiarioPage() {
  const [logs, setLogs] = useState<OBESessionLog[]>([]);
  const [mode, setMode] = useState<Mode>("list");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setLogs(loadSessionLogs());
      setHydrated(true);
    });
  }, []);

  const cooldown = useMemo(() => computeCooldown(logs), [logs]);
  const cooldownStyle = COOLDOWN_STYLE[cooldown.level];

  const handleSubmit = (log: OBESessionLog) => {
    const next = appendSessionLog(log);
    setLogs(next);
    setMode("list");
  };

  const handleDelete = (id: string) => {
    const next = deleteSessionLog(id);
    setLogs(next);
  };

  const sortedLogs = useMemo(
    () => [...logs].sort((a, b) => b.createdAt - a.createdAt),
    [logs]
  );

  return (
    <div className="max-w-3xl animate-fade-in">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Diario</h1>
          <p className="text-sm text-gray-400">
            Registro post-sesión y monitoreo de cooldown anti-burnout.
          </p>
        </div>
        {mode === "list" && (
          <button
            onClick={() => setMode("form")}
            className="px-4 py-2 bg-[#60a5fa] hover:bg-[#3b82f6] text-white text-sm font-semibold rounded-lg transition-colors flex-shrink-0"
          >
            + Nuevo registro
          </button>
        )}
      </div>

      {hydrated && mode === "list" && (
        <>
          {/* Cooldown banner */}
          <div
            className="border rounded-xl p-4 mb-6 flex items-start gap-3"
            style={{
              backgroundColor: cooldownStyle.bg,
              borderColor: cooldownStyle.border,
            }}
          >
            <span
              className="text-xl flex-shrink-0"
              style={{ color: cooldownStyle.text }}
            >
              {cooldownStyle.icon}
            </span>
            <div className="flex-1">
              <p
                className="text-sm font-semibold"
                style={{ color: cooldownStyle.text }}
              >
                {cooldown.level === "clear"
                  ? "Cooldown libre"
                  : cooldown.level === "caution"
                  ? "Atención: riesgo de acumulación"
                  : "Descanso requerido"}
              </p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                {cooldown.reason}
              </p>
              {cooldown.recommendedRestUntil && (
                <p className="text-xs text-gray-500 mt-1">
                  Próxima sesión recomendada{" "}
                  <strong style={{ color: cooldownStyle.text }}>
                    {formatRelativeTime(cooldown.recommendedRestUntil)}
                  </strong>
                  .
                </p>
              )}
              <p className="text-[10px] text-gray-600 mt-2">
                Sesiones en los últimos 7 días: {cooldown.sessionsLast7Days}
              </p>
            </div>
          </div>

          {/* Stats summary */}
          {logs.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <StatCard
                label="Total sesiones"
                value={logs.length.toString()}
                color="#60a5fa"
              />
              <StatCard
                label="Parálisis logradas"
                value={logs.filter((l) => l.paralysisAchieved).length.toString()}
                color="#a78bfa"
              />
              <StatCard
                label="Separaciones"
                value={logs.filter((l) => l.separation).length.toString()}
                color="#fbbf24"
              />
              <StatCard
                label="Claridad plena"
                value={logs
                  .filter((l) => l.visualClarity === "full")
                  .length.toString()}
                color="#4ade80"
              />
            </div>
          )}

          {/* Logs list */}
          {sortedLogs.length === 0 ? (
            <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-8 text-center">
              <p className="text-3xl mb-3">📓</p>
              <p className="text-sm text-white font-medium mb-1">
                Aún no hay registros
              </p>
              <p className="text-xs text-gray-500 mb-4">
                Captura tu primera sesión inmediatamente al regresar — la
                memoria del estado fuera del cuerpo se evapora rápido.
              </p>
              <button
                onClick={() => setMode("form")}
                className="px-4 py-2 bg-[#60a5fa] hover:bg-[#3b82f6] text-white text-sm rounded-lg transition-colors"
              >
                + Crear primer registro
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedLogs.map((log) => (
                <SessionLogItem
                  key={log.id}
                  log={log}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </>
      )}

      {hydrated && mode === "form" && (
        <SessionLogForm
          onSubmit={handleSubmit}
          onCancel={() => setMode("list")}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-3 text-center">
      <p
        className="text-2xl font-bold font-mono"
        style={{ color }}
      >
        {value}
      </p>
      <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">
        {label}
      </p>
    </div>
  );
}
