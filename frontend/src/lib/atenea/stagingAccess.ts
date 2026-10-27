import { createHash, randomBytes } from 'node:crypto';
import { decodeJwt } from 'jose';
import type { Redis } from '@upstash/redis';
import { liveReply } from './liveService';

export const ACCESS_COOKIE = '__Host-atenea-session';
export interface AppIdentity { user: string; expiresAt: number }
export interface IdentitySessions {
  verify(request: Request): Promise<string | null>;
  lookup(request: Request): Promise<AppIdentity | null>;
  issue(user: string, expiresAt: number): Promise<string | null>;
  revoke(request: Request): Promise<void>;
}
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export function accessCookie(request: Request) {
  const cookies = (request.headers.get('cookie') ?? '').split(';').map(item => item.trim()).filter(item => item.startsWith(ACCESS_COOKIE + '='));
  if (cookies.length !== 1) return null;
  const value = cookies[0].slice(ACCESS_COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(value) ? value : null;
}
const cookieHeader = (value: string, seconds: number) => `${ACCESS_COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${seconds}`;
const key = (value: string) => `fh:{atenea-live}:identity:${digest(value)}`;

export class RedisIdentitySessions implements IdentitySessions {
  constructor(private redis: Redis, readonly verify: IdentitySessions['verify'], private now: () => number = Date.now) {}
  async lookup(request: Request) {
    const value = accessCookie(request); if (!value) return null;
    const record = await this.redis.get<AppIdentity>(key(value));
    if (!record || !/^[a-f0-9]{64}$/.test(record.user) || !Number.isFinite(record.expiresAt) || record.expiresAt <= this.now()) return null;
    return record;
  }
  async issue(user: string, expiresAt: number) {
    const now = this.now();
    const seconds = Math.min(3600, Math.floor((expiresAt - now) / 1000));
    if (seconds < 1) return null;
    const token = randomBytes(32).toString('hex');
    const minute = Math.floor(now / 60000);
    const accepted = await this.redis.eval(`
local n = redis.call('INCR', KEYS[1]); redis.call('EXPIRE', KEYS[1], 120)
if n > 10 then return 0 end
redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[2]); return 1`,
      [`fh:{atenea-live}:login:${user}:${minute}`, key(token)], [JSON.stringify({ user, expiresAt }), seconds]);
    return accepted === 1 ? token : null;
  }
  async revoke(request: Request) { const value = accessCookie(request); if (value) await this.redis.del(key(value)); }
}

export interface AccessDependencies {
  enabled: boolean; origin: string; sessions: IdentitySessions;
  closeForUser(user: string): Promise<boolean>;
}
export async function accessRoute(request: Request, deps: AccessDependencies | null, visible: boolean, origin: string) {
  if (!visible && request.method !== 'DELETE') return liveReply(404, { error: 'not_found' });
  if (!origin || !deps || (!deps.enabled && request.method !== 'DELETE')) return liveReply(503, { error: 'identity_not_configured' });
  const suppliedOrigin = request.headers.get('origin');
  if (request.headers.get('sec-fetch-site') === 'cross-site' ||
      (suppliedOrigin && suppliedOrigin !== origin) || (request.method !== 'GET' && suppliedOrigin !== origin)) return liveReply(403, { error: 'forbidden' });
  try {
    if (request.method === 'GET') {
      const identity = await deps.sessions.lookup(request);
      return liveReply(200, { authenticated: Boolean(identity), ...(identity ? { expiresAt: identity.expiresAt } : {}) });
    }
    if (request.method === 'DELETE') {
      const identity = await deps.sessions.lookup(request);
      // Revoke the app session even when remote cleanup fails. The independent reaper retains ownership.
      let confirmed = false;
      try { if (identity) confirmed = await deps.closeForUser(identity.user); }
      finally { await deps.sessions.revoke(request); }
      const reply = liveReply(confirmed ? 200 : 202, { authenticated: false, remoteConfirmed: confirmed });
      reply.headers.set('Set-Cookie', cookieHeader('', 0)); return reply;
    }
    if (request.method !== 'POST') return liveReply(405, { error: 'method_not_allowed' });
    // Host SSO supplies the access token in a header; never accept it from a URL or browser storage.
    const user = await deps.sessions.verify(request);
    if (!user) return liveReply(401, { error: 'unauthorized' });
    const prior = await deps.sessions.lookup(request);
    if (prior && prior.user !== user) return liveReply(409, { error: 'logout_before_switching_user' });
    const token = request.headers.get('authorization')!.slice(7);
    // Signature/scope/issuer/audience were verified above before reading expiry.
    const expiry = decodeJwt(token).exp;
    if (typeof expiry !== 'number') return liveReply(401, { error: 'unauthorized' });
    const expiresAt = Math.min(expiry * 1000, Date.now() + 3600_000);
    const cookie = await deps.sessions.issue(user, expiresAt);
    if (!cookie) return liveReply(429, { error: 'login_rate_or_expiry_limit' });
    try { await deps.sessions.revoke(request); }
    catch { return liveReply(503, { error: 'rotation_unconfirmed' }); }
    const reply = liveReply(200, { authenticated: true, expiresAt });
    reply.headers.set('Set-Cookie', cookieHeader(cookie, Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))));
    return reply;
  } catch {
    const reply = liveReply(503, { error: 'identity_store_unavailable', ...(request.method === 'DELETE' ? { revocationConfirmed: false, remoteConfirmed: false } : {}) });
    if (request.method === 'DELETE') reply.headers.set('Set-Cookie', cookieHeader('', 0));
    return reply;
  }
}
