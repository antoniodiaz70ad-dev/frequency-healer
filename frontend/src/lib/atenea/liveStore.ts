import { Redis } from '@upstash/redis';
import { LIVE_DAILY_SECONDS, LIVE_MAX_SECONDS, type LiveRecord, type LiveStore } from './liveTypes';

// All keys share a hash tag so the atomic scripts also work on a clustered Redis.
const root = 'fh:{atenea-live}:';
const recordKey = (user: string, id: string) => `${root}record:${user}:${id}`;
const activeKey = (user: string) => `${root}active:${user}`;
const dueKey = `${root}due`;
const retention = 172800;
const reserveScript = `
if redis.call('EXISTS', KEYS[1]) == 1 or redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
local used = tonumber(redis.call('GET', KEYS[3]) or '0')
if used + tonumber(ARGV[2]) > tonumber(ARGV[3]) then return 0 end
redis.call('INCRBY', KEYS[3], ARGV[2]); redis.call('EXPIRE', KEYS[3], ARGV[4])
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[4])
redis.call('SET', KEYS[2], ARGV[5], 'EX', ARGV[4])
return 1`;
const bindScript = `
local raw = redis.call('GET', KEYS[1]); if not raw then return 0 end
local r = cjson.decode(raw); if r.closed or r.providerId then return 0 end
r.providerId = ARGV[1]
redis.call('SET', KEYS[1], cjson.encode(r), 'EX', ARGV[2])
redis.call('ZADD', KEYS[2], r.deadline, KEYS[1]); return 1`;
const finishScript = `
local raw = redis.call('GET', KEYS[1]); if not raw then return 0 end
local r = cjson.decode(raw); r.closed = true
redis.call('SET', KEYS[1], cjson.encode(r), 'EX', ARGV[2])
if redis.call('GET', KEYS[2]) == ARGV[1] then redis.call('DEL', KEYS[2]) end
redis.call('ZREM', KEYS[3], KEYS[1]); return 1`;

export class RedisLiveStore implements LiveStore {
  constructor(private redis: Redis) {}
  async reserve(user: string, requestId: string, now: number) {
    const day = new Date(now).toISOString().slice(0, 10);
    const record: LiveRecord = { user, requestId, deadline: now + LIVE_MAX_SECONDS * 1000, closed: false };
    return await this.redis.eval(reserveScript,
      [recordKey(user, requestId), activeKey(user), `${root}seconds:${user}:${day}`],
      [JSON.stringify(record), LIVE_MAX_SECONDS, LIVE_DAILY_SECONDS, retention, requestId]) === 1;
  }
  async bind(user: string, requestId: string, providerId: string) {
    const bound = await this.redis.eval(bindScript, [recordKey(user, requestId), dueKey], [providerId, retention]);
    if (bound !== 1) throw new Error('Reservation not available');
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
    return records.filter((record): record is LiveRecord => Boolean(record && !record.closed && record.providerId));
  }
}
