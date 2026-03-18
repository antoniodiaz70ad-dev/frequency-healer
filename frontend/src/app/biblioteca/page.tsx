"use client";

import { useState, useMemo, useCallback } from "react";
import { FREQUENCY_DATABASE, CATEGORY_INFO, DOMAIN_INFO, WAVEFORM_INFO, searchFrequencies } from "@/lib/frequencies";
import { getAudioEngine } from "@/lib/audioEngine";
import { FrequencyEntry } from "@/lib/types";

const EVIDENCE_INFO: Record<string, { label: string; color: string; icon: string }> = {
  verificada: { label: "Verificada", color: "#4ade80", icon: "✓" },
  anecdotica: { label: "Anecdótica", color: "#fbbf24", icon: "~" },
  especulativa: { label: "Especulativa", color: "#f87171", icon: "?" },
};

export default function BibliotecaPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterDomain, setFilterDomain] = useState<string>("all");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredFrequencies = useMemo(() => {
    let results: FrequencyEntry[] = searchQuery
      ? searchFrequencies(searchQuery)
      : [...FREQUENCY_DATABASE];

    if (filterCategory !== "all") {
      results = results.filter((f) => f.category === filterCategory);
    }
    if (filterDomain !== "all") {
      results = results.filter((f) => f.domain.includes(filterDomain as "cuerpo" | "alma" | "espiritu"));
    }

    return results.sort((a, b) => a.hz - b.hz);
  }, [searchQuery, filterCategory, filterDomain]);

  const handlePlayFrequency = useCallback((freq: FrequencyEntry) => {
    const engine = getAudioEngine();
    if (playingId === freq.id) {
      engine.stop();
      setPlayingId(null);
    } else {
      engine.stop();
      engine.play(freq.hz, freq.waveformRecommended, 0.4);
      setPlayingId(freq.id);
    }
  }, [playingId]);

  const categories = Object.keys(CATEGORY_INFO) as Array<keyof typeof CATEGORY_INFO>;
  const domains = Object.keys(DOMAIN_INFO) as Array<keyof typeof DOMAIN_INFO>;

  return (
    <div className="max-w-4xl animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Biblioteca de Frecuencias</h1>
        <p className="text-sm text-gray-400">
          {FREQUENCY_DATABASE.length} frecuencias documentadas para sanaci&oacute;n.
        </p>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
          <input
            type="text"
            placeholder="Buscar por nombre, frecuencia, dolencia..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-[#111827] border border-[#1f2937] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#60a5fa] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Category filters */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <button
          onClick={() => setFilterCategory("all")}
          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${filterCategory === "all" ? "border-[#60a5fa] bg-[#60a5fa15] text-[#60a5fa]" : "border-[#1f2937] text-gray-500 hover:text-white"}`}
        >
          Todas
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all`}
            style={
              filterCategory === cat
                ? { color: CATEGORY_INFO[cat].color, borderColor: CATEGORY_INFO[cat].color, backgroundColor: CATEGORY_INFO[cat].color + "15" }
                : { borderColor: "#1f2937", color: "#6b7280" }
            }
          >
            {CATEGORY_INFO[cat].icon} {CATEGORY_INFO[cat].label}
          </button>
        ))}
      </div>

      {/* Domain filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilterDomain("all")}
          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${filterDomain === "all" ? "border-[#60a5fa] bg-[#60a5fa15] text-[#60a5fa]" : "border-[#1f2937] text-gray-500 hover:text-white"}`}
        >
          Todos
        </button>
        {domains.map((d) => (
          <button
            key={d}
            onClick={() => setFilterDomain(d)}
            className="text-xs px-3 py-1.5 rounded-full border transition-all"
            style={
              filterDomain === d
                ? { color: DOMAIN_INFO[d].color, borderColor: DOMAIN_INFO[d].color, backgroundColor: DOMAIN_INFO[d].color + "15" }
                : { borderColor: "#1f2937", color: "#6b7280" }
            }
          >
            {DOMAIN_INFO[d].icon} {DOMAIN_INFO[d].label}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="text-xs text-gray-500 mb-4">{filteredFrequencies.length} resultados</p>

      {/* Frequency list */}
      <div className="space-y-2">
        {filteredFrequencies.map((freq) => {
          const isExpanded = expandedId === freq.id;
          const isCurrentlyPlaying = playingId === freq.id;
          const catInfo = CATEGORY_INFO[freq.category];
          const evidInfo = EVIDENCE_INFO[freq.evidence];

          return (
            <div
              key={freq.id}
              className={`bg-[#111827] border rounded-xl transition-all overflow-hidden ${isCurrentlyPlaying ? "border-[#60a5fa] ring-1 ring-[#60a5fa30]" : "border-[#1f2937] hover:border-[#374151]"}`}
            >
              {/* Main row */}
              <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : freq.id)}>
                {/* Play button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayFrequency(freq);
                  }}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm transition-all flex-shrink-0 ${isCurrentlyPlaying ? "bg-[#f87171] hover:bg-[#ef4444] text-white" : "bg-[#1f2937] hover:bg-[#374151] text-gray-400 hover:text-white"}`}
                >
                  {isCurrentlyPlaying ? "■" : "▶"}
                </button>

                {/* Frequency */}
                <div className="w-20 flex-shrink-0">
                  <p className="text-lg font-bold font-mono" style={{ color: catInfo.color }}>
                    {freq.hz >= 1000 ? `${(freq.hz / 1000).toFixed(freq.hz % 1000 === 0 ? 0 : 1)}k` : freq.hz}
                  </p>
                  <p className="text-[9px] text-gray-600">Hz</p>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{freq.name}</p>
                  <p className="text-xs text-gray-500 truncate">{freq.description}</p>
                </div>

                {/* Badges */}
                <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                  {freq.domain.map((d) => (
                    <span
                      key={d}
                      className="text-[9px] w-5 h-5 rounded-full flex items-center justify-center"
                      title={DOMAIN_INFO[d].label}
                      style={{ backgroundColor: DOMAIN_INFO[d].color + "20" }}
                    >
                      {DOMAIN_INFO[d].icon}
                    </span>
                  ))}
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: evidInfo.color + "20", color: evidInfo.color }}
                  >
                    {evidInfo.icon}
                  </span>
                </div>

                {/* Expand arrow */}
                <span className={`text-gray-600 transition-transform ${isExpanded ? "rotate-180" : ""}`}>▾</span>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-[#1f2937] pt-3 space-y-3">
                  <p className="text-sm text-gray-300">{freq.description}</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <p className="text-[10px] text-gray-600 uppercase">Frecuencia</p>
                      <p className="text-sm font-mono text-white">{freq.hz} Hz</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-600 uppercase">Categor&iacute;a</p>
                      <p className="text-sm" style={{ color: catInfo.color }}>
                        {catInfo.icon} {catInfo.label}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-600 uppercase">Onda Recomendada</p>
                      <p className="text-sm text-white">
                        {WAVEFORM_INFO[freq.waveformRecommended].icon} {WAVEFORM_INFO[freq.waveformRecommended].label}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-600 uppercase">Evidencia</p>
                      <p className="text-sm" style={{ color: evidInfo.color }}>
                        {evidInfo.icon} {evidInfo.label}
                      </p>
                    </div>
                  </div>

                  {/* Domain badges */}
                  <div className="flex gap-1.5">
                    {freq.domain.map((d) => (
                      <span
                        key={d}
                        className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: DOMAIN_INFO[d].color + "20", color: DOMAIN_INFO[d].color }}
                      >
                        {DOMAIN_INFO[d].icon} {DOMAIN_INFO[d].label}
                      </span>
                    ))}
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1">
                    {freq.tags.map((tag) => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded bg-[#0d1117] text-gray-500 border border-[#1f293750]">
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <p className="text-[10px] text-gray-600">Fuente: {freq.source}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredFrequencies.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-3xl mb-2">🔍</p>
          <p className="text-sm">No se encontraron frecuencias.</p>
          <p className="text-xs mt-1">Intenta con otros filtros o t&eacute;rminos de b&uacute;squeda.</p>
        </div>
      )}
    </div>
  );
}
