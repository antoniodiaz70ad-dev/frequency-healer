"use client";
import { VOICE_ENABLED, HARMONIC_ENABLED } from "@/lib/voice/feature";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navGroups = [
  { label: "Principal", items: [
    { href: "/", label: "Inicio", icon: "⚡" },
    ...(VOICE_ENABLED ? [{ href: "/voz", label: "Sesión guiada", icon: "✎" }] : []),
  ] },
  { label: "Explorar", items: [
    ...(HARMONIC_ENABLED ? [{ href: "/laboratorio-armonico", label: "Laboratorio Armónico", icon: "∿" }] : []),
    { href: "/biblioteca", label: "Atlas de frecuencias", icon: "◌" },
    { href: "/protocolos", label: "Protocolos históricos", icon: "≋" },
    { href: "/generador", label: "Generador manual", icon: "⌁" },
  ] },
  { label: "Personal", items: [
    { href: "/diario", label: "Diario OBE", icon: "□" },
  ] },
  { label: "Avanzado", items: [
    { href: "/sesion-nueva", label: "Exploración OBE", icon: "🌙" },
  ] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-[60] min-h-11 min-w-11 rounded-[var(--fh-radius-control)] border border-[var(--fh-border)] bg-[var(--fh-bg-raised)] p-2.5 text-[var(--fh-text-secondary)] transition-colors hover:text-[var(--fh-text)] md:hidden"
        aria-label="Menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-[65] md:hidden" onClick={() => setOpen(false)} />
      )}

      <aside className={`fixed left-0 top-0 z-[70] flex h-screen w-64 flex-col border-r border-[var(--fh-border)] bg-[var(--fh-bg-raised)] transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>
        <button onClick={() => setOpen(false)} className="absolute top-4 right-4 md:hidden text-gray-500 hover:text-white" aria-label="Cerrar">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="border-b border-[var(--fh-border)] p-6">
          <p className="fh-label">Personal acoustic system</p>
          <h1 className="mt-2 text-lg font-medium tracking-tight text-[var(--fh-text)]"><span className="mr-2 text-[var(--fh-accent)]">∿</span>Frequency Healer</h1>
        </div>

        <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto p-4 space-y-4">
          {navGroups.map(group => <div key={group.label}>
            <p className="fh-label mb-1 px-3 text-[10px]">{group.label}</p>
            {group.items.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                className={`flex min-h-11 items-center gap-3 rounded-[var(--fh-radius-control)] px-4 py-3 text-sm transition-colors ${isActive ? "bg-[var(--fh-surface-strong)] text-[var(--fh-accent)] font-medium" : "text-[var(--fh-text-muted)] hover:bg-[var(--fh-surface)] hover:text-[var(--fh-text)]"}`}>
                <span className="w-5 text-center text-base" aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}</div>)}
        </nav>

        <div className="border-t border-[var(--fh-border)] p-4">
          <p className="text-xs leading-5 text-[var(--fh-text-muted)]">Estructura armónica y aprendizaje personal auditable.</p>
        </div>
      </aside>
    </>
  );
}
