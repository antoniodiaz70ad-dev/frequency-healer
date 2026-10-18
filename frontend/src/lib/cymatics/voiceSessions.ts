import { validateCymaticsConfig } from './storage';
import { expandVoiceFrequency, voiceReading, type VoiceMultiplier, type VoiceReading } from './voice';
import type { CymaticsConfigV1 } from './types';

export interface VoiceCapture { multiplier: VoiceMultiplier; reading: VoiceReading; config: CymaticsConfigV1; createdAt: string; }
export interface VoiceSession { id: string; createdAt: string; captures: [VoiceCapture, VoiceCapture]; }
export const VOICE_SESSIONS_KEY = 'fh:voice-comparisons-v1';
const validDate = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
function validateSession(value: unknown): VoiceSession {
  if (!value || typeof value !== 'object') throw new Error('Sesión vocal inválida.');
  const row = value as VoiceSession;
  if (typeof row.id !== 'string' || !row.id || !validDate(row.createdAt) || !Array.isArray(row.captures) || row.captures.length !== 2) throw new Error('Sesión vocal incompleta.');
  const captures = row.captures.map(capture => {
    if (!capture || !validDate(capture.createdAt) || !capture.reading || !Number.isFinite(capture.reading.measuredAt) || !Number.isFinite(capture.reading.confidence) || !Number.isFinite(capture.reading.rms) || !voiceReading(capture.reading, capture.reading.measuredAt, .001)) throw new Error('Captura vocal inválida.');
    const config = validateCymaticsConfig(capture.config);
    if (expandVoiceFrequency(capture.reading.frequencyHz, capture.multiplier) !== config.channelFrequenciesHz[0]) throw new Error('Frecuencia vocal inconsistente.');
    return { multiplier: capture.multiplier, reading: { frequencyHz: capture.reading.frequencyHz, confidence: capture.reading.confidence, rms: capture.reading.rms, measuredAt: capture.reading.measuredAt }, config, createdAt: capture.createdAt };
  }) as VoiceSession['captures'];
  return { id: row.id, createdAt: row.createdAt, captures };
}
export function readVoiceSessions(storage: Pick<Storage, 'getItem'> = localStorage): VoiceSession[] {
  const raw = storage.getItem(VOICE_SESSIONS_KEY);
  if (!raw) return [];
  const rows: unknown = JSON.parse(raw);
  if (!Array.isArray(rows)) throw new Error('Registro vocal inválido; no fue modificado.');
  return rows.map(validateSession);
}
export function saveVoiceSession(row: VoiceSession, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): VoiceSession[] {
  const valid = validateSession(row), existing = readVoiceSessions(storage);
  if (existing.some(item => item.id === valid.id)) throw new Error('La sesión ya existe.');
  const next = [valid, ...existing];
  storage.setItem(VOICE_SESSIONS_KEY, JSON.stringify(next));
  return next;
}
