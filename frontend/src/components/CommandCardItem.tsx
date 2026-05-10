"use client";

import { useState } from "react";
import { CommandCard } from "@/lib/types";
import { PHASE_INFO } from "@/lib/commandCards";

interface Props {
  card: CommandCard;
}

export default function CommandCardItem({ card }: Props) {
  const [expanded, setExpanded] = useState(false);
  const phase = PHASE_INFO[card.phase];

  return (
    <div
      className={`bg-[#111827] border rounded-xl transition-all overflow-hidden ${
        expanded
          ? "ring-1"
          : "border-[#1f2937] hover:border-[#374151]"
      }`}
      style={
        expanded
          ? {
              borderColor: phase.color,
              boxShadow: `0 0 0 1px ${phase.color}30`,
            }
          : undefined
      }
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex items-start gap-3"
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
          style={{ backgroundColor: phase.color + "20", color: phase.color }}
        >
          {phase.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white">{card.title}</p>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: phase.color + "20",
                color: phase.color,
              }}
            >
              {phase.label}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{card.whenToUse}</p>
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
          {card.command && (
            <div
              className="rounded-lg p-3 border"
              style={{
                backgroundColor: phase.color + "10",
                borderColor: phase.color + "40",
              }}
            >
              <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">
                Comando
              </p>
              <p className="text-sm font-medium" style={{ color: phase.color }}>
                {card.command}
              </p>
            </div>
          )}

          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">
              Cómo aplicarla
            </p>
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
              {card.body}
            </p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">
              Por qué funciona
            </p>
            <p className="text-sm text-gray-400 leading-relaxed">{card.why}</p>
          </div>

          <div className="flex flex-wrap gap-1 pt-1">
            {card.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-2 py-0.5 rounded bg-[#0d1117] text-gray-500 border border-[#1f293750]"
              >
                #{tag}
              </span>
            ))}
          </div>

          {card.source && (
            <p className="text-[10px] text-gray-600">Fuente: {card.source}</p>
          )}
        </div>
      )}
    </div>
  );
}
