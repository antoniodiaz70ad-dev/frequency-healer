import type { Mode } from './contracts';

export interface LiveIdentity { user: string; sessionId: string; expiresAt: number }
export interface LiveRecord { user: string; requestId: string; sessionId?: string; cancelled?: boolean; providerId?: string; deadline: number; closed: boolean }
export interface LiveStore {
  reserve(user: string, requestId: string, now: number, sessionId: string): Promise<boolean>;
  bind(user: string, requestId: string, providerId: string): Promise<boolean>;
  find(user: string, requestId: string): Promise<LiveRecord | null>;
  finish(user: string, requestId: string): Promise<void>;
  defer(user: string, requestId: string, notBefore: number): Promise<void>;
  due(now: number): Promise<LiveRecord[]>;
}
export interface LiveProvider {
  create(sdp: string, mode: Mode, user: string): Promise<{ id: string; sdp: string }>;
  close(id: string): Promise<boolean>;
}
export interface LiveDependencies {
  origin: string; enabled: boolean;
  authenticate(request: Request): Promise<LiveIdentity | null>;
  store: LiveStore; provider: LiveProvider;
}
export const LIVE_MAX_SECONDS = 600;
export const LIVE_DAILY_SECONDS = 1800;
export const LIVE_CONSENT = 'atenea-live-audio-v1';
