export const CONSENT_KEY = 'fh:voice-consent-v1';
export const SETTINGS_KEY = 'fh:voice-settings-v1';
export function consentVersion(transcription: boolean, ai: boolean, processingVersion = 'v1') { return `v1:${transcription ? 'remote-audio' : 'manual'}:${ai ? 'optional-remote-intent' : 'local-intent'}:${processingVersion}`; }
export function loadConsent(version: string) {
  const raw = localStorage.getItem(CONSENT_KEY); if (!raw) return false;
  const value = JSON.parse(raw);
  if (value.schemaVersion !== 1 || typeof value.version !== 'string' || typeof value.acceptedAt !== 'string') throw new Error('Consentimiento guardado inválido; no se sobrescribió.');
  return value.version === version;
}
export function saveConsent(version: string) {
  loadConsent(version); // Validate before replacing a prior version.
  localStorage.setItem(CONSENT_KEY, JSON.stringify({ schemaVersion: 1, version, acceptedAt: new Date().toISOString() }));
}
// Technical counters only, in memory; no analytics endpoint or personal content.
export const technicalCounts = { voice_permission_denied: 0, transcription_failed: 0, capture_failed: 0 };
export function countTechnical(name: keyof typeof technicalCounts) { technicalCounts[name]++; }
