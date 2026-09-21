"use client";

import { useState } from "react";
import { CommandCard } from "@/lib/types";
import { PHASE_INFO } from "@/lib/commandCards";
import FHDisclosure from "@/components/ui/FHDisclosure";

interface Props {
  card: CommandCard;
}

export default function CommandCardItem({ card }: Props) {
  const [expanded, setExpanded] = useState(false);
  const phase = PHASE_INFO[card.phase];

  return (
    <article
      className={`obe-command-card ${expanded ? "obe-command-card--expanded" : ""}`}
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
        className="obe-command-card__header"
        aria-expanded={expanded}
      >
        <div
          className="obe-command-card__number"
          style={{ borderColor: phase.color, color: phase.color }}
          aria-hidden="true"
        >
          {String(phase.order).padStart(2, "0")}
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
          <p className="obe-command-card__timing">{card.whenToUse}</p>
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
        <div className="obe-command-card__content">
          <div>
            <p className="fh-label mb-1">
              Cómo aplicarla
            </p>
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
              {card.body}
            </p>
          </div>

          <div>
            <p className="fh-label mb-1">
              Propósito subjetivo
            </p>
            <p className="text-sm text-gray-400 leading-relaxed">{card.why}</p>
          </div>

          {card.command && <div className="obe-command-card__command" style={{ borderColor: phase.color + "70" }}><p className="fh-label mb-1">Comando</p><p style={{ color: phase.color }}>{card.command}</p></div>}

          <FHDisclosure summary="Detalles de la tarjeta">
            <div className="obe-command-card__metadata">
              <p><strong>ID</strong><code>{card.id}</code></p>
              <p><strong>Momento</strong><span>{card.whenToUse}</span></p>
              {card.source && <p><strong>Fuente</strong><span>{card.source}</span></p>}
              <div className="flex flex-wrap gap-1 pt-1">{card.tags.map(tag => <span key={tag} className="obe-tag">#{tag}</span>)}</div>
            </div>
          </FHDisclosure>
        </div>
      )}
    </article>
  );
}
