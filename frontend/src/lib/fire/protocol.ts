export const FIRE_TOTAL_MS = 420_000;
export const FIRE_PHASES = [
  { endMs: 60_000, label: 'Anclaje', guide: 'Siente el contacto del cuerpo y la postura. Respira de forma natural.' },
  { endMs: 180_000, label: 'Atención simultánea', guide: 'Continúa tu ejercicio mental y mantén conciencia del cuerpo. No necesitas una pantalla.' },
  { endMs: 300_000, label: 'Identificación de impulsos', guide: 'Reconoce pensamientos, emociones o impulsos que capturan tu atención, sin juzgarlos ni reprimirlos.' },
  { endMs: FIRE_TOTAL_MS, label: 'Metaconciencia', guide: 'Reconoce la tarea, tu reacción y el darte cuenta de ambas. Si te distraes, vuelve con suavidad.' },
] as const;

export function firePhaseAt(elapsedMs: number) {
  return FIRE_PHASES.findIndex(phase => elapsedMs < phase.endMs);
}

export function completedFirePhases(elapsedMs: number) {
  return FIRE_PHASES.filter(phase => elapsedMs >= phase.endMs).map(phase => phase.label);
}

/** Monotonic active time: paused time never advances a phase. */
export class FireClock {
  private accumulated = 0;
  private since: number | null = null;
  resume(now: number) { if (this.since === null && this.accumulated < FIRE_TOTAL_MS) this.since = now; }
  elapsed(now: number) { return Math.min(FIRE_TOTAL_MS, this.accumulated + (this.since === null ? 0 : Math.max(0, now - this.since))); }
  pause(now: number) { this.accumulated = this.elapsed(now); this.since = null; return this.accumulated; }
}

export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function fireSchedule(start: string) {
  const date = new Date(`${start}T12:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isFinite(date.getTime()) || localDay(date) !== start) throw new Error('Fecha inválida.');
  return Array.from({ length: 14 }, (_, day) => {
    const next = new Date(date);
    next.setDate(next.getDate() + day);
    return localDay(next);
  });
}
