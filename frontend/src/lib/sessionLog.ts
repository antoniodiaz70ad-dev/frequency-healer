import { OBESessionLog } from './types';

/**
 * Persistencia local de los logs post-sesión y cálculo de estado de
 * cooldown / burnout. Sin backend — todo client-side en localStorage.
 *
 * El cooldown se basa en dos señales:
 *
 *  1. Energía post-sesión: si el usuario reporta ≤3 (1-10) tras la
 *     última sesión, se recomienda un descanso largo (7 días). El
 *     sistema nervioso autónomo necesita resincronizarse.
 *
 *  2. Frecuencia: ≥3 sesiones en los últimos 7 días dispara aviso de
 *     riesgo de burnout aunque la energía esté alta. Esto previene
 *     desregulación acumulativa.
 */

const STORAGE_KEY = 'fh:obe-session-logs-v1';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export function loadSessionLogs(): OBESessionLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as OBESessionLog[];
  } catch {
    return [];
  }
}

export function saveSessionLogs(logs: OBESessionLog[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}

export function appendSessionLog(log: OBESessionLog): OBESessionLog[] {
  const all = loadSessionLogs();
  const next = [log, ...all];
  saveSessionLogs(next);
  return next;
}

export function deleteSessionLog(id: string): OBESessionLog[] {
  const filtered = loadSessionLogs().filter((l) => l.id !== id);
  saveSessionLogs(filtered);
  return filtered;
}

// ─── Cooldown / burnout heuristics ─────────────────────────────────────

export type CooldownLevel = 'clear' | 'caution' | 'rest-required';

export interface CooldownState {
  level: CooldownLevel;
  reason: string;
  recommendedRestUntil?: number;   // epoch ms
  sessionsLast7Days: number;
  lastSession?: OBESessionLog;
}

export function computeCooldown(logs: OBESessionLog[]): CooldownState {
  if (logs.length === 0) {
    return {
      level: 'clear',
      reason: 'Sin sesiones registradas. Listo para empezar.',
      sessionsLast7Days: 0,
    };
  }

  const sorted = [...logs].sort((a, b) => b.createdAt - a.createdAt);
  const last = sorted[0];
  const now = Date.now();

  const sessionsLast7Days = logs.filter(
    (l) => now - l.createdAt <= SEVEN_DAYS_MS
  ).length;

  // Rule 1: low post-energy after last session → 7-day rest
  if (last.postEnergy <= 3) {
    const restUntil = last.createdAt + SEVEN_DAYS_MS;
    if (now < restUntil) {
      return {
        level: 'rest-required',
        reason: `Tu última sesión te dejó energía ${last.postEnergy}/10. El sistema nervioso autónomo necesita 7 días de descanso completo antes de la próxima.`,
        recommendedRestUntil: restUntil,
        sessionsLast7Days,
        lastSession: last,
      };
    }
  }

  // Rule 2: separation achieved (intense) → 3-day rest
  if (last.separation) {
    const restUntil = last.createdAt + THREE_DAYS_MS;
    if (now < restUntil) {
      return {
        level: 'rest-required',
        reason: `Tu última sesión incluyó separación. Las sesiones intensas requieren al menos 3 días de descanso para evitar desregulación.`,
        recommendedRestUntil: restUntil,
        sessionsLast7Days,
        lastSession: last,
      };
    }
  }

  // Rule 3: 3+ sessions in last 7 days → caution
  if (sessionsLast7Days >= 3) {
    return {
      level: 'caution',
      reason: `${sessionsLast7Days} sesiones en los últimos 7 días. Considera tomar al menos 2-3 días de pausa para evitar burnout acumulativo.`,
      sessionsLast7Days,
      lastSession: last,
    };
  }

  return {
    level: 'clear',
    reason: 'Listo para una nueva sesión.',
    sessionsLast7Days,
    lastSession: last,
  };
}

export function formatRelativeTime(ms: number): string {
  const diff = ms - Date.now();
  if (diff <= 0) return 'ya disponible';
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours < 24) return `en ~${hours} h`;
  const days = Math.floor(hours / 24);
  return `en ~${days} día${days === 1 ? '' : 's'}`;
}

export function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function newSessionId(): string {
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
