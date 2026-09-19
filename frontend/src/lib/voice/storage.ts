import { buildSchedule, type HarmonicConfig, type RatioId } from '../harmonic/math';
import { validateProposal } from './rules';
import { object, text, validateIntent, validateRatings } from './validation';
import { SETTINGS_KEY } from './privacy';
import type { SessionMarkerV1, VoiceSessionProposalV1, VoiceSessionRecordV1 } from './types';
export const SESSIONS_KEY = 'fh:voice-sessions-v1';
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
export type Lock = <T>(operation: () => T | Promise<T>) => Promise<T>;
function finite(v: unknown, min: number, max: number) { if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new Error('Número inválido.'); return v; }
function iso(v: unknown) { const s = text(v, 50); if (!Number.isFinite(Date.parse(s))) throw new Error('Fecha inválida.'); return s; }
function validateConfig(value: unknown): HarmonicConfig {
  const c = object(value);
  const result: HarmonicConfig = { baseHz: c.baseHz as number, ratioId: c.ratioId as RatioId, increments: c.increments as number, direction: c.direction as HarmonicConfig['direction'], mode: c.mode as HarmonicConfig['mode'], durationSeconds: c.durationSeconds as number, uiVolume: c.uiVolume as number, waveform: c.waveform as 'sine', ...(c.progression === undefined ? {} : { progression: c.progression as RatioId[] }) };
  buildSchedule(result); return result;
}
export function validateRecord(value: unknown): VoiceSessionRecordV1 {
  const v = object(value), p = object(v.proposal), tech = object(v.technical);
  if (v.schemaVersion !== 1 || !['completed', 'stopped', 'error'].includes(String(v.status))) throw new Error('Versión o estado inválidos.');
  const config = validateConfig(p.harmonicConfig), intent = validateIntent(v.intent);
  if (!Array.isArray(p.rationale) || !Array.isArray(p.warnings) || !['local-rule', 'user-customized'].includes(String(p.source))) throw new Error('Propuesta inválida.');
  const proposal = validateProposal({ schemaVersion: p.schemaVersion, proposalId: text(p.proposalId, 100), ruleId: text(p.ruleId, 100), ruleVersion: p.ruleVersion, source: p.source,
    intent: validateIntent(p.intent), harmonicConfig: config, schedule: p.schedule, rationale: p.rationale.map(x => text(x)), warnings: p.warnings.map(x => text(x)), requiresExplicitExperimentalConsent: p.requiresExplicitExperimentalConsent } as VoiceSessionProposalV1);
  if (JSON.stringify(intent) !== JSON.stringify(proposal.intent)) throw new Error('Intención inconsistente.');
  if (!Array.isArray(v.markers) || v.markers.length > 500) throw new Error('Marcadores inválidos.');
  const duration = finite(tech.actualDurationMs, 0, 3600000);
  const markers: SessionMarkerV1[] = v.markers.map(item => {
    const m = object(item), h = object(m.harmonicSnapshot);
    if (!['insight', 'observation', 'command', 'custom'].includes(String(m.kind)) || !Array.isArray(h.activeHz) || h.activeHz.length > 9) throw new Error('Marcador inválido.');
    if (h.stepIndex !== null && (!Number.isInteger(h.stepIndex) || Number(h.stepIndex) < 0 || Number(h.stepIndex) >= proposal.schedule.steps.length)) throw new Error('Paso inválido.');
    return { id: text(m.id, 100), offsetMs: finite(m.offsetMs, 0, duration), wallClockCreatedAt: iso(m.wallClockCreatedAt), kind: m.kind as SessionMarkerV1['kind'],
      ...(m.note === undefined ? {} : { note: text(m.note, 500, true) }), ...(m.transcript === undefined ? {} : { transcript: text(m.transcript, 500, true) }),
      harmonicSnapshot: { stepIndex: h.stepIndex as number | null, baseHz: finite(h.baseHz, 40, 2000), activeHz: h.activeHz.map(f => finite(f, 40, 2000)), ratioId: text(h.ratioId, 50) } };
  });
  return { schemaVersion: 1, id: text(v.id, 100), createdAt: iso(v.createdAt), ...(v.completedAt === undefined ? {} : { completedAt: iso(v.completedAt) }), status: v.status as VoiceSessionRecordV1['status'], intent, proposal,
    ...(v.before === undefined ? {} : { before: validateRatings(v.before) }), ...(v.after === undefined ? {} : { after: validateRatings(v.after) }), markers,
    ...(v.reflection === undefined ? {} : { reflection: text(v.reflection, 500, true) }), ...(v.originalWords === undefined ? {} : { originalWords: text(v.originalWords, 500, true) }),
    technical: { actualDurationMs: duration, ...(tech.stopReason === undefined ? {} : { stopReason: text(tech.stopReason, 50) }) } };
}
export function loadRecords(storage: StorageLike): VoiceSessionRecordV1[] { return parseRecords(storage.getItem(SESSIONS_KEY)); }
function parseRecords(raw: string | null): VoiceSessionRecordV1[] {
  if (raw === null) return [];
  try { const rows = JSON.parse(raw); if (!Array.isArray(rows) || rows.length > 100) throw new Error(); const records = rows.map(validateRecord); if (new Set(records.map(r => r.id)).size !== records.length) throw new Error(); return records; }
  catch { throw new Error('Historial de voz inválido. No se sobrescribió. Exporta el contenido original antes de repararlo.'); }
}
export const browserLock: Lock = async operation => {
  if (!navigator.locks) throw new Error('Este navegador no ofrece bloqueo seguro entre pestañas. Conserva o exporta la sesión en memoria.');
  return navigator.locks.request(SESSIONS_KEY, () => operation());
};
export class VoiceStore {
  constructor(private storage: StorageLike, private lock: Lock = browserLock) {}
  load() { return loadRecords(this.storage); }
  private mutate(change: (rows: VoiceSessionRecordV1[]) => VoiceSessionRecordV1[]) {
    return this.lock(() => { const original = this.storage.getItem(SESSIONS_KEY); const rows = parseRecords(original); const next = change(rows);
      if (this.storage.getItem(SESSIONS_KEY) !== original) throw new Error('Otra pestaña cambió el historial. Vuelve a intentar.');
      this.storage.setItem(SESSIONS_KEY, JSON.stringify(next)); return next;
    });
  }
  save(value: VoiceSessionRecordV1) { const record = validateRecord(value); return this.mutate(rows => { if (rows.some(r => r.id === record.id)) return rows; if (rows.length >= 100) throw new Error('Límite de 100 sesiones. Exporta o borra registros antes de guardar.'); return [record, ...rows]; }); }
  remove(id: string) { return this.mutate(rows => rows.filter(r => r.id !== id)); }
  clear() { return this.mutate(() => []); }
}
export function loadSettings(storage: StorageLike) {
  const raw = storage.getItem(SETTINGS_KEY); if (raw === null) return { schemaVersion: 1 as const, keepOriginal: false };
  const value = object(JSON.parse(raw)); if (value.schemaVersion !== 1 || typeof value.keepOriginal !== 'boolean') throw new Error('Preferencias inválidas; no se sobrescribieron.');
  return { schemaVersion: 1 as const, keepOriginal: value.keepOriginal };
}
export function saveSettings(storage: StorageLike, keepOriginal: boolean) { loadSettings(storage); storage.setItem(SETTINGS_KEY, JSON.stringify({ schemaVersion: 1, keepOriginal })); }
