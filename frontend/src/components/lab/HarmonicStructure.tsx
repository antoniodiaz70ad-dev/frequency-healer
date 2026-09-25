import type { HarmonicConfig, HarmonicSchedule } from "@/lib/harmonic/math";

export default function HarmonicStructure({ config, schedule }: { config: HarmonicConfig; schedule: HarmonicSchedule }) {
  const members = schedule.steps.flatMap((step, stepIndex) => step.frequencies.map((frequency, memberIndex) => ({
    frequency,
    ratio: step.ratios[memberIndex] ?? "relación registrada",
    stepIndex,
  })));
  const width = 720;
  const left = 70;
  const right = 650;
  const x = (index: number) => members.length < 2 ? width / 2 : left + index * (right - left) / (members.length - 1);

  return <figure className="overflow-hidden rounded-[var(--fh-radius-surface)] border border-[var(--fh-border)] bg-[var(--fh-bg)] p-4" aria-labelledby="harmonic-map-title">
    <figcaption id="harmonic-map-title" className="mb-3 flex flex-wrap items-end justify-between gap-2"><span><strong className="block font-medium text-[var(--fh-text)]">Estructura armónica actual</strong><span className="text-sm text-[var(--fh-text-muted)]">{config.mode === "sequence" ? "Orden de reproducción" : "Voces simultáneas"}</span></span><span className="font-mono text-sm text-[var(--fh-accent)]">{config.baseHz} Hz · {members.length} {members.length === 1 ? "miembro" : "miembros"}</span></figcaption>
    <svg className="h-auto w-full min-w-0" viewBox="0 0 720 190" role="img" aria-label={`Mapa de ${members.length} frecuencias ya validadas`}>
      <line x1={left} y1="82" x2={right} y2="82" stroke="var(--fh-border-strong)" strokeWidth="1" />
      {members.map((member, index) => <g key={`${member.stepIndex}-${index}-${member.frequency}`}>
        <circle cx={x(index)} cy="82" r={index === 0 ? 24 : 18} fill={index === 0 ? "var(--fh-accent)" : "var(--fh-harmonic)"} fillOpacity={index === 0 ? 0.95 : 0.75} />
        <text x={x(index)} y="87" textAnchor="middle" fontSize="10" fill="var(--fh-accent-ink)" fontFamily="var(--font-geist-mono)">{index + 1}</text>
        <text x={x(index)} y="125" textAnchor="middle" fontSize="12" fill="var(--fh-text)" fontFamily="var(--font-geist-mono)">{Number(member.frequency.toFixed(2))} Hz</text>
        <text x={x(index)} y="147" textAnchor="middle" fontSize="11" fill="var(--fh-text-muted)" fontFamily="var(--font-geist-mono)">{member.ratio}</text>
      </g>)}
    </svg>
    <p className="text-xs leading-5 text-[var(--fh-text-muted)]">Representación de los valores del plan actual. Conserva orden y multiplicidad; no calcula ni aproxima relaciones nuevas.</p>
  </figure>;
}
