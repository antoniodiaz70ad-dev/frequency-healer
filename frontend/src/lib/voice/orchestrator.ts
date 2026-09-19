import { HarmonicEngine } from '../harmonic/engine';
import { RunScope, transition, type JourneyState } from './stateMachine';
import { buildProposal, validateProposal, type ProposalEdits } from './rules';
import { parseCommand } from './commands';
import { validateRatings, parseIntentJSON, text } from './validation';
import { parseLocalIntent } from './intentParser';
import type { ParsedIntentionV1, VoiceSessionProposalV1, VoiceSessionRecordV1, SelfRatingV1, SessionMarkerV1 } from './types';

export class VoiceOrchestrator {
  state: JourneyState = 'idle';
  intent: ParsedIntentionV1 | null = null;
  proposal: VoiceSessionProposalV1 | null = null;
  record: VoiceSessionRecordV1 | null = null;
  error = '';
  readonly runs = new RunScope();
  private listeners = new Set<() => void>();
  private started = 0;
  private markerDraft: SessionMarkerV1 | null = null;
  constructor(readonly engine = new HarmonicEngine()) {}
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getState = () => this.state;
  move(next: JourneyState) {
    const result = transition(this.state, next);
    if (result === this.state) return false;
    this.state = result; this.listeners.forEach(fn => fn()); return true;
  }
  interpret(raw: string) {
    if (!this.move('interpreting')) return;
    try { this.intent = parseLocalIntent(raw); this.error = ''; this.move('review_intent'); }
    catch (e) { this.error = (e as Error).message; this.move('interpretation_error'); }
  }
  async interpretRemote(raw: string) {
    if (!this.move('interpreting')) return;
    const { runId, signal } = this.runs.begin();
    try {
      const response = await fetch('/api/voice/interpret', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript: raw }), signal });
      if (!response.ok) throw new Error('Asistente no disponible.');
      const intent = parseIntentJSON(await response.text());
      if (!this.runs.current(runId)) return;
      this.intent = intent; this.error = ''; this.move('review_intent');
    } catch {
      if (!this.runs.current(runId)) return;
      this.error = 'El asistente no devolvió una intención válida. Revisa el formulario local.';
      try { this.intent = parseLocalIntent(raw); } catch { this.intent = { ...parseLocalIntent('Exploración personal'), intention: raw.slice(0, 500) || 'Exploración personal' }; }
      this.move('review_intent');
    }
  }
  propose(intent: ParsedIntentionV1, edits: ProposalEdits = {}) {
    if (!this.move('building_session')) return;
    try { this.proposal = buildProposal(intent, edits); this.intent = this.proposal.intent; this.error = ''; this.move('review_session'); }
    catch (e) { this.error = (e as Error).message; this.move('interpretation_error'); }
  }
  async start(experimentalConsent: boolean, before: Partial<SelfRatingV1> = {}) {
    if (this.state !== 'review_session' || !this.proposal) return;
    const proposal = validateProposal(this.proposal);
    const ratings = validateRatings(before);
    if (proposal.requiresExplicitExperimentalConsent && !experimentalConsent) throw new Error('Confirma la exploración experimental.');
    if (!this.move('starting')) return;
    const { runId } = this.runs.begin();
    try {
      const started = await this.engine.start(proposal.harmonicConfig, () => { if (this.runs.current(runId)) this.stop('completed'); });
      if (!started || !this.runs.current(runId)) return;
      this.started = performance.now();
      this.record = { schemaVersion: 1, id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: 'stopped', before: ratings, intent: proposal.intent, proposal, markers: [], technical: { actualDurationMs: 0 } };
      this.move('playing');
    } catch (e) { if (this.runs.current(runId)) { this.error = (e as Error).message; this.move('audio_error'); } }
  }
  markerSnapshot(): SessionMarkerV1 {
    if (!this.record || !this.proposal || !['playing', 'marker_listening'].includes(this.state)) throw new Error('No hay sesión activa.');
    return { id: crypto.randomUUID(), offsetMs: this.elapsedMs(), wallClockCreatedAt: new Date().toISOString(), kind: 'custom',
      harmonicSnapshot: { ...this.engine.snapshot(), baseHz: this.proposal.harmonicConfig.baseHz, ratioId: this.proposal.harmonicConfig.ratioId } };
  }
  async beginMarkerCapture() {
    if (!this.move('marker_listening')) return false;
    this.markerDraft = this.markerSnapshot();
    return this.engine.duck();
  }
  endMarkerCapture() {
    if (this.state !== 'marker_listening') return;
    this.engine.restore(); this.move('playing');
  }
  cancelMarkerCapture() { this.markerDraft = null; this.endMarkerCapture(); }
  applyMarker(raw: string, confirmStop = false) {
    if (this.state !== 'playing' || !this.record) return;
    const note = text(raw), command = parseCommand(note);
    if (command.type === 'stop_session' && !confirmStop) return 'confirm_stop';
    const marker = this.markerDraft ?? this.markerSnapshot();
    if (command.type === 'volume_relative') this.engine.setVolume(this.engine.getVolume() + command.delta);
    if (this.record.markers.length >= 500) throw new Error('Límite de 500 marcadores por sesión.');
    this.record.markers.push({ ...marker, kind: command.type === 'none' ? 'observation' : 'command', note });
    this.markerDraft = null;
    if (command.type === 'stop_session') this.stop('voice_confirmed');
    return 'applied';
  }
  finishRecord(after: Partial<SelfRatingV1>, reflection: string, originalWords?: string) {
    if (!this.record || !['reflection', 'storage_error'].includes(this.state)) throw new Error('No hay reflexión para guardar.');
    return { ...this.record, after: validateRatings(after), reflection: text(reflection, 500, true), ...(originalWords === undefined ? {} : { originalWords: text(originalWords, 500, true) }) };
  }
  elapsedMs() { return this.record ? Math.min(this.proposal!.schedule.durationSeconds * 1000, Math.max(0, performance.now() - this.started)) : 0; }
  stop(reason = 'user') {
    if (!['starting', 'playing', 'marker_listening'].includes(this.state)) { this.cancel(); return; }
    this.move('stopping'); this.runs.cancel();
    if (this.record) {
      this.record.technical.actualDurationMs = reason === 'completed' ? this.proposal!.schedule.durationSeconds * 1000 : this.elapsedMs();
      this.record.technical.stopReason = reason; this.record.completedAt = new Date().toISOString();
      this.record.status = reason === 'completed' ? 'completed' : 'stopped';
    }
    this.engine.stop(); this.move(this.record ? 'reflection' : 'idle');
  }
  cancel() {
    if (['playing', 'marker_listening', 'starting'].includes(this.state)) { this.stop(); return; }
    this.runs.cancel(); this.engine.stop(); this.record = null; this.markerDraft = null; this.error = ''; this.move('idle');
  }
  dispose() { this.runs.cancel(); this.engine.dispose(); }
}
