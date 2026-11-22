/** Playback hints and lock-screen controls, with optional-browser-API fallbacks. */
type AudioSession = { type: string };
type PlaybackNavigator = { audioSession?: AudioSession; mediaSession?: MediaSession };
const leases = new WeakMap<AudioSession, { users: number; previous: string }>();
const mediaOwners = new WeakMap<MediaSession, symbol>();
const currentNavigator = (): PlaybackNavigator => typeof navigator === 'undefined' ? {} : navigator as Navigator & PlaybackNavigator;

export function acquirePlaybackSession(scope = currentNavigator()): () => void {
  const session = scope.audioSession;
  if (!session) return () => {};
  let entry = leases.get(session);
  if (!entry) {
    try {
      const previous = session.type;
      session.type = 'playback';
      entry = { users: 0, previous }; leases.set(session, entry);
    } catch { return () => {}; }
  }
  entry.users++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--entry.users > 0) return;
    leases.delete(session);
    try { if (session.type === 'playback') session.type = entry.previous; } catch {}
  };
}

export type MarinaMediaControls = { play: () => void; pause: () => void; stop: () => void };
export function registerMarinaMediaSession(title: string, durationMs: number, controls: MarinaMediaControls, scope = currentNavigator()) {
  const media = scope.mediaSession, owner = Symbol('marina-media');
  const actions = ['play', 'pause', 'stop'] as const;
  if (media) {
    mediaOwners.set(media, owner);
    try {
      if (typeof MediaMetadata !== 'undefined') media.metadata = new MediaMetadata({ title, artist: 'Resonance Lab', album: 'Marina · Punto Cero' });
    } catch {}
    for (const action of actions) { try { media.setActionHandler(action, controls[action]); } catch {} }
  }
  return {
    update(state: 'playing' | 'paused', positionMs: number) {
      if (!media || mediaOwners.get(media) !== owner) return;
      try { media.playbackState = state; } catch {}
      if (Number.isFinite(durationMs) && durationMs > 0 && Number.isFinite(positionMs)) {
        try { media.setPositionState({ duration: durationMs / 1000, position: Math.max(0, Math.min(durationMs, positionMs)) / 1000, playbackRate: 1 }); } catch {}
      }
    },
    dispose() {
      if (!media || mediaOwners.get(media) !== owner) return;
      mediaOwners.delete(media);
      for (const action of actions) { try { media.setActionHandler(action, null); } catch {} }
      try { media.playbackState = 'none'; media.metadata = null; media.setPositionState(); } catch {}
    },
  };
}
