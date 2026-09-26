'use client';

import { useEffect, useState } from 'react';

type WakeLockSentinelLike = {
  released?: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: 'release', listener: () => void) => void;
  removeEventListener?: (type: 'release', listener: () => void) => void;
};

type WakeLockLike = { request: (type: 'screen') => Promise<WakeLockSentinelLike> };

type NavigatorWithWakeLock = { wakeLock?: WakeLockLike };

type PlaybackWakeLockState = 'idle' | 'active' | 'unsupported' | 'released' | 'blocked';

export function supportsScreenWakeLock(navigatorLike: NavigatorWithWakeLock | undefined): boolean {
  return typeof navigatorLike?.wakeLock?.request === 'function';
}

export async function requestScreenWakeLock(navigatorLike: NavigatorWithWakeLock | undefined): Promise<WakeLockSentinelLike | null> {
  if (!supportsScreenWakeLock(navigatorLike)) return null;
  return navigatorLike!.wakeLock!.request('screen');
}

/**
 * Keeps the display awake while a session is playing when the browser supports
 * Screen Wake Lock. This prevents auto-lock from silently interrupting WebAudio.
 * Manual device locking and background WebAudio remain browser/OS controlled.
 */
export function usePlaybackWakeLock(active: boolean): PlaybackWakeLockState {
  const [state, setState] = useState<PlaybackWakeLockState>('idle');

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let sentinel: WakeLockSentinelLike | null = null;
    const releaseListener = () => { if (!cancelled) setState('released'); };

    const release = async () => {
      if (!sentinel) return;
      const current = sentinel;
      sentinel = null;
      current.removeEventListener?.('release', releaseListener);
      try { if (!current.released) await current.release(); } catch {}
    };

    const acquire = async () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        setState('released');
        return;
      }
      if (typeof navigator === 'undefined' || !supportsScreenWakeLock(navigator as NavigatorWithWakeLock)) {
        setState('unsupported');
        return;
      }
      try {
        await release();
        sentinel = await requestScreenWakeLock(navigator as NavigatorWithWakeLock);
        if (cancelled) { await release(); return; }
        sentinel?.addEventListener?.('release', releaseListener);
        setState(sentinel ? 'active' : 'unsupported');
      } catch {
        if (!cancelled) setState('blocked');
      }
    };

    const visibility = () => {
      if (document.visibilityState === 'visible') void acquire();
      else { void release(); setState('released'); }
    };

    void acquire();
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', visibility);
      void release();
    };
  }, [active]);

  return active ? state : 'idle';
}

export function playbackWakeLockMessage(state: PlaybackWakeLockState): string {
  if (state === 'active') return 'La pantalla se mantendrá activa durante la reproducción si el navegador lo permite.';
  if (state === 'unsupported' || state === 'blocked') return 'Para escuchar sin interrupciones en iPhone, mantén esta pantalla abierta; iOS puede pausar WebAudio al bloquear el equipo.';
  if (state === 'released') return 'La reproducción puede pausarse si la pantalla se bloquea o el navegador suspende la pestaña.';
  return '';
}
