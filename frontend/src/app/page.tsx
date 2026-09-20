"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HARMONIC_ENABLED, VOICE_ENABLED } from "@/lib/voice/feature";
import { VoiceStore } from "@/lib/voice/storage";
import type { VoiceSessionRecordV1 } from "@/lib/voice/types";
import { FHEmptyState, FHPageHeader, FHPageShell, FHPrimaryCard, FHSection, FHSurface } from "@/components/ui/FHLayout";
import { FHStateBadge } from "@/components/ui/FHBadges";
import FHMetric from "@/components/ui/FHMetric";

const explore = [
  { href: "/laboratorio-armonico", title: "Laboratorio Armónico", text: "Construye, escucha y comprende relaciones armónicas exactas.", gated: true },
  { href: "/biblioteca", title: "Atlas de frecuencias", text: "Consulta el archivo histórico y exploratorio con su clasificación." },
  { href: "/protocolos", title: "Protocolos históricos", text: "Revisa secuencias heredadas y su estado actual." },
  { href: "/generador", title: "Generador manual", text: "Configura directamente una señal como herramienta avanzada." },
];

function formatDate(value: string | number) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(value));
}

export default function DashboardPage() {
  const [latest, setLatest] = useState<VoiceSessionRecordV1 | null>(null);
  const [historyAvailable, setHistoryAvailable] = useState(true);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const records = new VoiceStore(localStorage).load();
        setLatest(records[0] ?? null);
      } catch {
        setHistoryAvailable(false);
      }
    });
  }, []);

  return <FHPageShell>
    <FHPageHeader eyebrow="Sistema personal de exploración acústica" title="Frequency Healer" description="Define una intención, escucha una estructura armónica y registra tu propia experiencia." />
    <nav aria-label="Formas de explorar">
      {VOICE_ENABLED && <FHPrimaryCard className="relative overflow-hidden">
        <p className="fh-label">Sesión guiada</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-medium tracking-[-0.035em] text-[var(--fh-text)] md:text-4xl">¿Qué quieres explorar hoy?</h2>
        <p className="mt-4 max-w-xl text-base leading-7 text-[var(--fh-text-secondary)]">Describe lo que quieres explorar y Frequency Healer te propondrá una sesión.</p>
        <p className="mt-2 text-sm text-[var(--fh-text-muted)]">Puedes escribir tu intención o usar voz si lo prefieres. El micrófono es opcional.</p>
        <Link className="fh-action fh-action--primary mt-7" href="/voz">Comenzar sesión guiada <span aria-hidden="true">→</span></Link>
      </FHPrimaryCard>}
      <FHSection title="Tu actividad">
        {!historyAvailable ? <FHEmptyState>El historial personal no está disponible en este dispositivo. No se modificó ningún dato.</FHEmptyState> : latest ? <FHSurface variant="subtle" className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center">
          <div><div className="flex flex-wrap items-center gap-2"><FHStateBadge state={latest.status}>Sesión {latest.status === "completed" ? "completada" : latest.status}</FHStateBadge><span className="text-xs text-[var(--fh-text-muted)]">{formatDate(latest.createdAt)}</span></div><h3 className="mt-3 text-lg font-medium text-[var(--fh-text)]">{latest.intent.intention}</h3><p className="mt-1 text-sm text-[var(--fh-text-secondary)]">Tu registro permanece en este dispositivo.</p></div>
          <FHMetric label="Duración prevista" value={`${latest.intent.durationMinutes} min`} />
        </FHSurface> : <FHEmptyState><h3 className="text-lg font-medium text-[var(--fh-text)]">Tu aprendizaje empieza con una sesión</h3><p className="mx-auto mt-2 max-w-lg">Cuando guardes una sesión, aquí aparecerá contexto real de tu actividad. No generamos datos personales de ejemplo.</p></FHEmptyState>}
      </FHSection>
      <FHSection title="Explorar con más detalle">
        <div className="grid gap-3 md:grid-cols-2">
          {explore.filter(item => !item.gated || HARMONIC_ENABLED).map(item => <Link key={item.href} href={item.href} className="group min-h-32 rounded-[var(--fh-radius-surface)] border border-[var(--fh-border)] bg-[var(--fh-surface)] p-5 transition-colors hover:border-[var(--fh-border-strong)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--fh-accent)]"><h3 className="font-medium text-[var(--fh-text)] group-hover:text-[var(--fh-accent)]">{item.title} <span aria-hidden="true">↗</span></h3><p className="mt-2 text-sm leading-6 text-[var(--fh-text-muted)]">{item.text}</p></Link>)}
        </div>
      </FHSection>
      <FHSection><FHSurface variant="subtle" className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="fh-label">Exploración avanzada</p><h2 className="mt-2 font-medium text-[var(--fh-text)]">Práctica y diario OBE</h2><p className="mt-1 text-sm text-[var(--fh-text-muted)]">Herramientas exploratorias separadas del recorrido principal.</p></div><Link className="fh-action fh-action--secondary" href="/sesion-nueva">Abrir exploración OBE</Link></FHSurface></FHSection>
    </nav>
  </FHPageShell>;
}
