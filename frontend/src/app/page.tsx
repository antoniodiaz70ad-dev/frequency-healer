"use client";

import Link from "next/link";
import { FREQUENCY_DATABASE, DOMAIN_INFO, CATEGORY_INFO } from "@/lib/frequencies";
import { PROTOCOLS } from "@/lib/protocols";

const QUICK_FREQUENCIES = [
  { id: "sol-528", label: "528 Hz Milagro", color: "#fbbf24" },
  { id: "bw-gamma", label: "40 Hz Gamma", color: "#60a5fa" },
  { id: "bw-schumann", label: "7.83 Hz Schumann", color: "#a78bfa" },
  { id: "mus-432", label: "432 Hz Natural", color: "#4ade80" },
  { id: "rife-727", label: "727 Hz Rife", color: "#f87171" },
  { id: "sol-963", label: "963 Hz Corona", color: "#67e8f9" },
];

const DOMAIN_CARDS = [
  {
    domain: "cuerpo" as const,
    title: "Cuerpo",
    icon: "🫀",
    subtitle: "Sanaci\u00f3n F\u00edsica",
    description: "Frecuencias Rife, CAFL y Nogier para el cuerpo f\u00edsico.",
    gradient: "from-[#f8717120] to-transparent",
    borderColor: "#f87171",
  },
  {
    domain: "alma" as const,
    title: "Alma",
    icon: "🧘",
    subtitle: "Equilibrio Emocional",
    description: "Solfeggio, binaural beats y ondas cerebrales para la mente.",
    gradient: "from-[#a78bfa20] to-transparent",
    borderColor: "#a78bfa",
  },
  {
    domain: "espiritu" as const,
    title: "Esp\u00edritu",
    icon: "✨",
    subtitle: "Conexi\u00f3n Espiritual",
    description: "Frecuencias superiores Solfeggio y meditaci\u00f3n profunda.",
    gradient: "from-[#67e8f920] to-transparent",
    borderColor: "#67e8f9",
  },
];

export default function DashboardPage() {
  const freqsByCat = Object.keys(CATEGORY_INFO) as Array<keyof typeof CATEGORY_INFO>;
  const totalFrequencies = FREQUENCY_DATABASE.length;
  const totalProtocols = PROTOCOLS.length;
  const cuerpoCount = FREQUENCY_DATABASE.filter((f) => f.domain.includes("cuerpo")).length;
  const almaCount = FREQUENCY_DATABASE.filter((f) => f.domain.includes("alma")).length;
  const espirituCount = FREQUENCY_DATABASE.filter((f) => f.domain.includes("espiritu")).length;

  return (
    <div className="max-w-4xl animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-1">Frequency Healer</h1>
        <p className="text-sm text-gray-400">Sanaci&oacute;n con frecuencias para cuerpo, alma y esp&iacute;ritu.</p>
      </div>

      {/* Domain cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {DOMAIN_CARDS.map((card) => (
          <Link
            key={card.domain}
            href="/biblioteca"
            className={`bg-gradient-to-br ${card.gradient} bg-[#111827] border border-[#1f2937] rounded-xl p-5 hover:border-[#374151] transition-all group`}
          >
            <span className="text-3xl">{card.icon}</span>
            <h3 className="text-lg font-bold text-white mt-2">{card.title}</h3>
            <p className="text-xs font-medium mt-0.5" style={{ color: card.borderColor }}>
              {card.subtitle}
            </p>
            <p className="text-xs text-gray-500 mt-2">{card.description}</p>
          </Link>
        ))}
      </div>

      {/* Quick frequencies */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white">Frecuencias R&aacute;pidas</h3>
          <Link href="/generador" className="text-xs text-[#60a5fa] hover:text-white transition-colors">
            Generador →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {QUICK_FREQUENCIES.map((qf) => {
            const freq = FREQUENCY_DATABASE.find((f) => f.id === qf.id);
            return (
              <Link
                key={qf.id}
                href="/generador"
                className="p-3 rounded-lg border border-[#1f2937] hover:border-[#374151] transition-all group"
              >
                <p className="text-xl font-bold font-mono group-hover:brightness-125 transition-all" style={{ color: qf.color }}>
                  {freq?.hz ?? ""}
                  <span className="text-xs text-gray-600 ml-1">Hz</span>
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">{qf.label}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Protocols quick access */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white">Protocolos de Sanaci&oacute;n</h3>
          <Link href="/protocolos" className="text-xs text-[#60a5fa] hover:text-white transition-colors">
            Ver todos →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {PROTOCOLS.slice(0, 4).map((protocol) => (
            <Link
              key={protocol.id}
              href="/protocolos"
              className="flex items-center gap-3 p-3 rounded-lg border border-[#1f2937] hover:border-[#374151] transition-all"
            >
              <span className="text-xl">{protocol.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{protocol.name}</p>
                <p className="text-[10px] text-gray-500">
                  {protocol.totalDurationMinutes} min &middot; {protocol.steps.length} pasos
                </p>
              </div>
              <div className="flex gap-0.5">
                {protocol.domain.map((d) => (
                  <span
                    key={d}
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[8px]"
                    style={{ backgroundColor: DOMAIN_INFO[d].color + "20" }}
                  >
                    {DOMAIN_INFO[d].icon}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold font-mono text-[#60a5fa]">{totalFrequencies}</p>
          <p className="text-[10px] text-gray-500 mt-1">Frecuencias</p>
        </div>
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold font-mono text-[#fbbf24]">{totalProtocols}</p>
          <p className="text-[10px] text-gray-500 mt-1">Protocolos</p>
        </div>
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold font-mono text-[#4ade80]">5</p>
          <p className="text-[10px] text-gray-500 mt-1">Categor&iacute;as</p>
        </div>
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold font-mono text-[#a78bfa]">22 kHz</p>
          <p className="text-[10px] text-gray-500 mt-1">Rango M&aacute;x</p>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-5 mb-6">
        <h3 className="text-sm font-bold text-white mb-3">Por Categor&iacute;a</h3>
        <div className="space-y-2">
          {freqsByCat.map((cat) => {
            const count = FREQUENCY_DATABASE.filter((f) => f.category === cat).length;
            const pct = (count / totalFrequencies) * 100;
            return (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-sm w-6 text-center">{CATEGORY_INFO[cat].icon}</span>
                <span className="text-xs text-gray-400 w-28">{CATEGORY_INFO[cat].label}</span>
                <div className="flex-1 bg-[#1f2937] rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: CATEGORY_INFO[cat].color }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Domain breakdown */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-5">
        <h3 className="text-sm font-bold text-white mb-3">Por Dominio</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-2xl" style={{ backgroundColor: "#f8717120" }}>
              🫀
            </div>
            <p className="text-sm font-bold text-white mt-2">Cuerpo</p>
            <p className="text-lg font-mono font-bold" style={{ color: "#f87171" }}>{cuerpoCount}</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-2xl" style={{ backgroundColor: "#a78bfa20" }}>
              🧘
            </div>
            <p className="text-sm font-bold text-white mt-2">Alma</p>
            <p className="text-lg font-mono font-bold" style={{ color: "#a78bfa" }}>{almaCount}</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-2xl" style={{ backgroundColor: "#67e8f920" }}>
              ✨
            </div>
            <p className="text-sm font-bold text-white mt-2">Esp&iacute;ritu</p>
            <p className="text-lg font-mono font-bold" style={{ color: "#67e8f9" }}>{espirituCount}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
