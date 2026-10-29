import { Redis } from '@upstash/redis';
import { LIVE_DAILY_SECONDS, LIVE_MAX_SECONDS, type LiveRecord, type LiveStore } from './liveTypes';

// All keys share a hash tag so the atomic scripts also work on a clustered Redis.
const root = 'fh:{atenea-live}:';
const recordKey = (user: string, id: string) => `${root}record:${user}:${id}`;
const activeKey = (user: string) => `${root}active:${user}`;
const dueKey = `${root}due`;
const retention = 172800;
const reserveScript = `
local identity = redis.call('GET', KEYS[4]); if not identity then return 0 end
local owner = cjson.decode(identity)
if owner.user ~= ARGV[6] or tonumber(owner.expiresAt) <= tonumber(ARGV[7]) then return 0 end
if redis.call('EXISTS', KEYS[1]) == 1 or redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
local used = tonumber(redis.call('GET', KEYS[3]) or '0')
if used + tonumber(ARGV[2]) > tonumber(ARGV[3]) then return 0 end
redis.call('INCRBY', KEYS[3], ARGV[2]); redis.call('EXPIRE', KEYS[3], ARGV[4])
redis.call('SET', KEYS[1], ARGV[1])
redis.call('SET', KEYS[2], ARGV[5])
local record = cjson.decode(ARGV[1]); redis.call('ZADD', KEYS[5], record.deadline, KEYS[1])
return 1`;
const bindScript = `
local raw = redis.call('GET', KEYS[1]); if not raw then return 0 end
local r = cjson.decode(raw); if r.closed or r.providerId then return 0 end
r.providerId = ARGV[1]
local valid = false
if r.sessionId then
  local identity = redis.call('GET', ARGV[3] .. r.sessionId)
  if identity then
    local owner = cjson.decode(identity)
    valid = owner.user == r.user and tonumber(owner.expiresAt) > tonumber(ARGV[4])
  end
end
if not valid or r.cancelled then r.cancelled = true; r.deadline = 0 end
redis.call('SET', KEYS[1], cjson.encode(r))
redis.call('ZADD', KEYS[2], r.deadline, KEYS[1]); if r.cancelled then return 2 end; return 1`;
const finishScript = `
local raw = redis.call('GET', KEYS[1]); if not raw then return 0 end
local r = cjson.decode(raw); r.closed = true
redis.call('SET', KEYS[1], cjson.encode(r), 'EX', ARGV[2])
if redis.call('GET', KEYS[2]) == ARGV[1] then redis.call('DEL', KEYS[2]) end
redis.call('ZREM', KEYS[3], KEYS[1]); return 1`;

export class RedisLiveStore implements LiveStore {
  constructor(private redis: Redis) {}
  async reserve(user: string, requestId: string, now: number, sessionId: string) {
    if (!/^[a-f0-9]{64}$/.test(sessionId)) return false;
    const day = new Date(now).toISOString().slice(0, 10);
    const record: LiveRecord = { user, requestId, sessionId, deadline: now + LIVE_MAX_SECONDS * 1000, closed: false };
    return await this.redis.eval(reserveScript,
      [recordKey(user, requestId), activeKey(user), `${root}seconds:${user}:${day}`, `${root}identity:${sessionId}`, dueKey],
      [JSON.stringify(record), LIVE_MAX_SECONDS, LIVE_DAILY_SECONDS, retention, requestId, user, now]) === 1;
  }
  async bind(user: string, requestId: string, providerId: string) {
    const bound = await this.redis.eval(bindScript, [recordKey(user, requestId), dueKey], [providerId, retention, `${root}identity:`, Date.now()]);
    if (bound !== 1 && bound !== 2) throw new Error('Reservation not available');
    return bound === 1;
  }
  async find(user: string, requestId: string) {
    return this.redis.get<LiveRecord>(recordKey(user, requestId));
  }
  async active(user: string) {
    const requestId = await this.redis.get<string>(activeKey(user));
    if (!requestId) return null;
    const record = await this.find(user, requestId);
    if (!record) throw new Error('Active session metadata unavailable');
    return record;
  }
  async finish(user: string, requestId: string) {
    await this.redis.eval(finishScript, [recordKey(user, requestId), activeKey(user), dueKey], [requestId, retention]);
  }
  async due(now: number) {
    const keys = await this.redis.zrange<string[]>(dueKey, 0, now, { byScore: true, offset: 0, count: 25 });
    if (!keys.length) return [];
    const records = await this.redis.mget<(LiveRecord | null)[]>(...keys);
    const stale = keys.filter((_, index) => !records[index] || records[index]!.closed);
    if (stale.length) await this.redis.zrem(dueKey, ...stale);
    // Pending/ambiguous creates count as unresolved work, even without a provider ID.
    return records.filter((record): record is LiveRecord => Boolean(record && !record.closed));
  }
}
