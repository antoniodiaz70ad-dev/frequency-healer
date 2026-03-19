"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", icon: "⚡" },
  { href: "/generador", label: "Generador", icon: "🔊" },
  { href: "/protocolos", label: "Protocolos", icon: "📋" },
  { href: "/biblioteca", label: "Biblioteca", icon: "📚" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const handleClose = useCallback(() => setOpen(false), []);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, handleClose]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-[60] md:hidden bg-[#111827] border border-[#1f2937] rounded-lg p-2.5 text-gray-400 hover:text-white transition-colors"
        aria-label="Abrir menú de navegación"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-[65] md:hidden" onClick={handleClose} />
      )}

      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-[#111827] border-r border-[#1f2937] flex flex-col z-[70] transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
        role="navigation"
        aria-label="Navegación principal"
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 md:hidden text-gray-500 hover:text-white"
          aria-label="Cerrar menú"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <Link href="/" onClick={handleClose} className="block p-6 border-b border-[#1f2937] hover:bg-[#1f293730] transition-colors">
          <h1 className="text-lg font-bold text-[#67e8f9]">Frequency</h1>
          <h2 className="text-lg font-bold text-white">Healer</h2>
          <p className="text-xs text-gray-500 mt-1">Cuerpo · Alma · Espíritu</p>
        </Link>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleClose}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm ${isActive ? "bg-[#1e3a5f] text-[#60a5fa] font-medium" : "text-gray-400 hover:text-white hover:bg-[#1f2937]"}`}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="text-lg" aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#1f2937]">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <div className="w-2 h-2 rounded-full bg-[#f87171] animate-pulse-glow" aria-hidden="true" /><span>Cuerpo</span>
            <div className="w-2 h-2 rounded-full bg-[#a78bfa] animate-pulse-glow" aria-hidden="true" /><span>Alma</span>
            <div className="w-2 h-2 rounded-full bg-[#67e8f9] animate-pulse-glow" aria-hidden="true" /><span>Espíritu</span>
          </div>
        </div>
      </aside>
    </>
  );
}
