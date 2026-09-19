export const TRANSITIONS = {
  idle: ['requesting_permission', 'review_transcript'],
  requesting_permission: ['listening', 'permission_denied', 'unsupported', 'transcription_error', 'idle'],
  listening: ['transcribing', 'transcription_error', 'idle'],
  transcribing: ['review_transcript', 'transcription_error', 'idle'],
  review_transcript: ['interpreting', 'requesting_permission', 'idle'],
  interpreting: ['review_intent', 'interpretation_error', 'idle'],
  review_intent: ['building_session', 'review_transcript', 'idle'],
  building_session: ['review_session', 'interpretation_error', 'idle'],
  review_session: ['starting', 'review_intent', 'idle'],
  starting: ['playing', 'stopping', 'audio_error', 'idle'],
  playing: ['marker_listening', 'stopping'],
  marker_listening: ['playing', 'stopping'],
  stopping: ['reflection', 'idle'],
  reflection: ['saved', 'storage_error', 'idle'],
  saved: ['idle'],
  permission_denied: ['review_transcript', 'requesting_permission', 'idle'],
  unsupported: ['review_transcript', 'idle'],
  transcription_error: ['review_transcript', 'requesting_permission', 'idle'],
  interpretation_error: ['review_transcript', 'review_intent', 'idle'],
  audio_error: ['review_session', 'idle'],
  storage_error: ['reflection', 'saved', 'idle'],
} as const;
export type JourneyState = keyof typeof TRANSITIONS;
export function transition(state: JourneyState, next: JourneyState): JourneyState {
  return (TRANSITIONS[state] as readonly string[]).includes(next) ? next : state;
}
export class RunScope {
  private generation = 0;
  private controller = new AbortController();
  begin() { this.cancel(); return { runId: this.generation, signal: this.controller.signal }; }
  current(runId: number) { return runId === this.generation && !this.controller.signal.aborted; }
  cancel() { this.controller.abort(); ++this.generation; this.controller = new AbortController(); }
}
