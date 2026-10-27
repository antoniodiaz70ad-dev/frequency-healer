import type { Mode } from './contracts';

export interface LiveRecord { user: string; requestId: string; providerId?: string; deadline: number; closed: boolean }
export interface LiveStore {
  reserve(user: string, requestId: string, now: number): Promise<boolean>;
  bind(user: string, requestId: string, providerId: string): Promise<void>;
  find(user: string, requestId: string): Promise<LiveRecord | null>;
  finish(user: string, requestId: string): Promise<void>;
  due(now: number): Promise<LiveRecord[]>;
}
export interface LiveProvider {
  create(sdp: string, mode: Mode, user: string): Promise<{ id: string; sdp: string }>;
  close(id: string): Promise<boolean>;
}
export interface LiveDependencies {
  origin: string; enabled: boolean;
  authenticate(request: Request): Promise<string | null>;
  reserve(request: Request, user: string, requestId: string, now: number): Promise<'reserved' | 'unauthorized' | 'limited'>;
  creationAuthorized(request: Request, user: string): Promise<boolean>;
  store: LiveStore; provider: LiveProvider;
}
export const LIVE_MAX_SECONDS = 600;
export const LIVE_DAILY_SECONDS = 1800;
export const LIVE_CONSENT = 'atenea-live-audio-v1';
