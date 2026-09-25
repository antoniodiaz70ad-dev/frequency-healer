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
import { FHEvidenceBadge } from "@/components/ui/FHBadges";
import { FHEmptyState, FHPageHeader, FHPageShell } from "@/components/ui/FHLayout";
import FHMetric from "@/components/ui/FHMetric";

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
    <FHPageShell width="default" className="obe-page obe-diary animate-fade-in">
      <div className="obe-diary__header">
        <FHPageHeader eyebrow={<span className="obe-header-label"><span>REGISTRO PERSONAL · OBE</span><FHEvidenceBadge category="EXPLORATORY">EXPLORATORIO</FHEvidenceBadge></span>} title="Diario OBE" description="Registro de experiencias subjetivas y pausas conservadoras." />
        {mode === "list" && (
          <button
            onClick={() => setMode("form")}
            className="fh-action fh-action--primary flex-shrink-0"
          >
            + Nuevo registro
          </button>
        )}
      </div>

      {hydrated && mode === "list" && (
        <>
          {/* Cooldown banner */}
          <div
            className="obe-cooldown"
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
                  ? "Pausa no requerida"
                  : cooldown.level === "caution"
                  ? "Considera una pausa"
                  : "Pausa recomendada"}
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
            <div className="obe-metrics">
              <StatCard
                label="Total sesiones"
                value={logs.length.toString()}
                color="#60a5fa"
              />
              <StatCard
                label="Parálisis percibidas"
                value={logs.filter((l) => l.paralysisAchieved).length.toString()}
                color="#a78bfa"
              />
              <StatCard
                label="Separaciones percibidas"
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
            <FHEmptyState>
              <p className="fh-label mb-2">REGISTRO OBE</p>
              <h2 className="text-lg text-white font-medium mb-1">
                Aún no hay registros
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                Registra recuerdos, sensaciones e interpretaciones después de
                la práctica, sin asumir que describen eventos externos.
              </p>
              <button
                onClick={() => setMode("form")}
                className="fh-action fh-action--primary"
              >
                + Crear primer registro
              </button>
            </FHEmptyState>
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
    </FHPageShell>
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
    <div className="obe-metric" style={{ borderColor: color }}><FHMetric label={label} value={value} /></div>
  );
}
