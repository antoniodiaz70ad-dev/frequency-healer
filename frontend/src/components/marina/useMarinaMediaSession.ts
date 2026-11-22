'use client';

import { useEffect, useRef } from 'react';
import { registerMarinaMediaSession, type MarinaMediaControls } from '@/lib/marina/backgroundPlayback';

export function useMarinaMediaSession(title: string, durationMs: number, elapsedMs: number, enabled: boolean, playing: boolean, controls: MarinaMediaControls) {
  const callbacks = useRef(controls);
  const binding = useRef<ReturnType<typeof registerMarinaMediaSession> | null>(null);
  useEffect(() => { callbacks.current = controls; }, [controls]);
  useEffect(() => {
    if (!enabled) return;
    const current = registerMarinaMediaSession(title, durationMs, {
      play: () => callbacks.current.play(), pause: () => callbacks.current.pause(), stop: () => callbacks.current.stop(),
    });
    binding.current = current;
    return () => { current.dispose(); if (binding.current === current) binding.current = null; };
  }, [enabled, title, durationMs]);
  useEffect(() => { binding.current?.update(playing ? 'playing' : 'paused', elapsedMs); }, [playing, elapsedMs, enabled, title, durationMs]);
}
