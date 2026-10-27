import { createHash, randomBytes } from 'node:crypto';
import { decodeJwt } from 'jose';
import type { Redis } from '@upstash/redis';
import { liveReply } from './liveService';
import type { RedisLiveStore } from './liveStore';
import type { LiveDependencies } from './liveTypes';

export const ACCESS_COOKIE = '__Host-atenea-session';
export interface AppIdentity { user: string; expiresAt: number }
interface StoredIdentity extends AppIdentity { accessId: string; rotated?: boolean }
export interface SessionAuthority extends AppIdentity { identityKey: string; familyKey: string; accessId: string }
type IssueResult = { cookie: string } | { error: 'stale' | 'limited' };
export interface IdentitySessions {
  verify(request: Request): Promise<string | null>;
  lookup(request: Request): Promise<AppIdentity | null>;
  issue(user: string, expiresAt: number, previous: string | null, grant: string): Promise<IssueResult>;
  revoke(request: Request): Promise<AppIdentity | null>;
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
const familyKey = (id: string) => `fh:{atenea-live}:access:${id}`;
const validRecord = (record: StoredIdentity | null): record is StoredIdentity => Boolean(record &&
  /^[a-f0-9]{64}$/.test(record.user) && /^[a-f0-9]{64}$/.test(record.accessId) && Number.isFinite(record.expiresAt));

export class RedisIdentitySessions implements IdentitySessions {
  constructor(private redis: Redis, readonly verify: IdentitySessions['verify'], private now: () => number = Date.now) {}
  async authority(request: Request): Promise<SessionAuthority | null> {
    const value = accessCookie(request); if (!value) return null;
    const record = await this.redis.get<StoredIdentity>(key(value));
    if (!validRecord(record) || record.rotated || record.expiresAt <= this.now()) return null;
    if (await this.redis.get<string>(familyKey(record.accessId)) !== record.user) return null;
    return { ...record, identityKey: key(value), familyKey: familyKey(record.accessId) };
  }
  async lookup(request: Request) {
    const record = await this.authority(request);
    return record ? { user: record.user, expiresAt: record.expiresAt } : null;
  }
  async issue(user: string, expiresAt: number, previous: string | null, grant: string): Promise<IssueResult> {
    if (!/^[a-f0-9]{64}$/.test(user) || !/^[a-f0-9]{64}$/.test(grant) || (previous && !/^[a-f0-9]{64}$/.test(previous))) return { error: 'stale' };
    const prior = previous ? await this.redis.get<StoredIdentity>(key(previous)) : null;
    if (previous && (!validRecord(prior) || prior.rotated || prior.user !== user)) return { error: 'stale' };
    const now = this.now();
    const seconds = Math.min(3600, Math.floor((expiresAt - now) / 1000));
    if (!Number.isFinite(seconds) || seconds < 1) return { error: 'stale' };
    expiresAt = Math.min(expiresAt, now + seconds * 1000);
    const token = randomBytes(32).toString('hex');
    const accessId = prior?.accessId ?? randomBytes(32).toString('hex');
    const minute = Math.floor(now / 60000);
    const accepted = await this.redis.eval(`
local previous = nil
if ARGV[3] == '1' then
  local raw = redis.call('GET', KEYS[3]); if not raw then return -1 end
  previous = cjson.decode(raw)
  if previous.rotated or previous.user ~= ARGV[4] or previous.accessId ~= ARGV[5]
      or previous.expiresAt <= tonumber(ARGV[6]) or redis.call('GET', KEYS[4]) ~= ARGV[4] then return -1 end
end
-- A verified token may rotate its own live family, but cannot reopen a revoked one.
local grantOwner = redis.call('GET', KEYS[5])
if grantOwner and (ARGV[3] ~= '1' or grantOwner ~= ARGV[5]) then return -1 end
local n = redis.call('INCR', KEYS[1]); redis.call('EXPIRE', KEYS[1], 120)
if n > 10 then return 0 end
-- Retain a rotated cookie only as a logout handle, never as an authentication grant.
if previous then
  previous.rotated = true; redis.call('SET', KEYS[3], cjson.encode(previous), 'EX', 3600)
end
redis.call('SET', KEYS[2], ARGV[1], 'EX', 3600)
redis.call('SET', KEYS[4], ARGV[4], 'EX', ARGV[2])
redis.call('SET', KEYS[5], ARGV[5], 'EX', 3600)
return 1`,
      [`fh:{atenea-live}:login:${user}:${minute}`, key(token), previous ? key(previous) : key(token), familyKey(accessId), `fh:{atenea-live}:grant:${grant}`],
      [JSON.stringify({ user, expiresAt, accessId }), seconds, previous ? 1 : 0, user, accessId, now]);
    return accepted === 1 ? { cookie: token } : { error: accepted === 0 ? 'limited' : 'stale' };
  }
  async revoke(request: Request) {
    const value = accessCookie(request); if (!value) return null;
    const record = await this.redis.get<StoredIdentity>(key(value));
    if (!validRecord(record)) return null;
    // Rotation keeps this family stable. A logout with the previous cookie therefore
    // revokes a replacement issued concurrently, even if its response arrives later.
    await this.redis.del(familyKey(record.accessId));
    return { user: record.user, expiresAt: record.expiresAt };
  }
}

/** Provider tokens are accepted only by the verified exchange, never by voice creation. */
export function cookieLiveAccess(sessions: RedisIdentitySessions, store: RedisLiveStore): Pick<LiveDependencies, 'authenticate' | 'reserve' | 'creationAuthorized'> {
  return {
    authenticate: request => sessions.lookup(request).then(identity => identity?.user ?? null),
    reserve: async (request, user, id, now) => {
      const authority = await sessions.authority(request);
      return authority ? store.reserveForSession(authority, user, id, now) : 'unauthorized';
    },
    creationAuthorized: async (request, user) => (await sessions.lookup(request))?.user === user,
  };
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
      // Revoke before observing active voice. This deletion and creation reservations
      // share Redis: either creation sees revoked access or cleanup sees its reservation.
      const identity = await deps.sessions.revoke(request);
      let confirmed = false;
      try { if (identity) confirmed = await deps.closeForUser(identity.user); }
      catch { /* The reaper retains unresolved reservations. */ }
      const reply = liveReply(confirmed ? 200 : 202, { authenticated: false, revocationConfirmed: true, remoteConfirmed: confirmed });
      reply.headers.set('Set-Cookie', cookieHeader('', 0)); return reply;
    }
    if (request.method !== 'POST') return liveReply(405, { error: 'method_not_allowed' });
    // Host SSO supplies the access token in a header; never accept it from a URL or browser storage.
    const user = await deps.sessions.verify(request);
    if (!user) return liveReply(401, { error: 'unauthorized' });
    const prior = await deps.sessions.lookup(request);
    if (prior && prior.user !== user) return liveReply(409, { error: 'logout_before_switching_user' });
    const previous = accessCookie(request);
    if (previous && !prior) return liveReply(409, { error: 'identity_exchange_rejected' });
    const token = request.headers.get('authorization')!.slice(7);
    // Signature/scope/issuer/audience were verified above before reading expiry.
    const expiry = decodeJwt(token).exp;
    if (typeof expiry !== 'number') return liveReply(401, { error: 'unauthorized' });
    const expiresAt = Math.min(expiry * 1000, Date.now() + 3600_000);
    const issued = await deps.sessions.issue(user, expiresAt, previous, digest(token));
    if ('error' in issued) return liveReply(issued.error === 'limited' ? 429 : 409, { error: 'identity_exchange_rejected' });
    const reply = liveReply(200, { authenticated: true, expiresAt });
    reply.headers.set('Set-Cookie', cookieHeader(issued.cookie, Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))));
    return reply;
  } catch {
    const reply = liveReply(503, { error: 'identity_store_unavailable', ...(request.method === 'DELETE' ? { revocationConfirmed: false, remoteConfirmed: false } : {}) });
    // Keep the HttpOnly cookie when revocation failed so the authenticated action can
    // be retried. The UI has already stopped capture and blocked new local starts.
    return reply;
  }
}
