import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Redis } from '@upstash/redis';
import { RedisLiveStore } from '../src/lib/atenea/liveStore';
import { ACCESS_COOKIE, RedisIdentitySessions } from '../src/lib/atenea/stagingAccess';

/** Real Redis integration in CI; no production credentials or remote URLs are accepted. */
test('Redis Lua reservations serialize concurrent workers, reject replays, enforce owner and budget, retain unresolved close', {
  skip: !process.env.ATENEA_TEST_REDIS_PORT,
}, async () => {
  const port = process.env.ATENEA_TEST_REDIS_PORT!;
  assert.match(port, /^\d{1,5}$/);
  const exec = promisify(execFile);
  const command = async (...args: (string | number)[]) => {
    const { stdout } = await exec('redis-cli', ['-h', '127.0.0.1', '-p', port, '--json', ...args.map(String)]);
    return JSON.parse(stdout);
  };
  const decode = (value: unknown): unknown => typeof value === 'string' && value.startsWith('{') ? JSON.parse(value) : value;
  const client = {
    eval: (script: string, keys: string[], args: (string | number)[]) => command('EVAL', script, keys.length, ...keys, ...args),
    get: async (key: string) => decode(await command('GET', key)),
    zrange: (key: string, min: number, max: number) => command('ZRANGEBYSCORE', key, min, max, 'LIMIT', 0, 25),
    mget: async (...keys: string[]) => (await command('MGET', ...keys) as unknown[]).map(decode),
    zrem: (key: string, ...members: string[]) => command('ZREM', key, ...members),
    del: (...keys: string[]) => command('DEL', ...keys),
  } as unknown as Redis;
  const store = new RedisLiveStore(client); const user = `ci-${crypto.randomUUID()}`; const now = Date.now();
  const reservations = await Promise.all(Array.from({ length: 12 }, (_, i) => store.reserve(user, `request-${i}`, now)));
  assert.equal(reservations.filter(Boolean).length, 1);
  const id = `request-${reservations.indexOf(true)}`;
  await store.bind(user, id, 'live_ci');
  assert.equal(await store.find('another-user', id), null);
  assert.equal(await store.reserve(user, 'blocked', now), false);
  assert.equal((await store.due(now + 600001)).some(record => record.user === user), true);
  await store.finish(user, id); await store.finish(user, id);
  assert.equal((await store.find(user, id))!.closed, true);
  assert.equal(await store.reserve(user, id, now), false);
  for (const next of ['second', 'third']) { assert.equal(await store.reserve(user, next, now), true); await store.finish(user, next); }
  assert.equal(await store.reserve(user, 'over-budget', now), false);
  // An expired record must not leave a stale sorted-set member blocking the watchdog's first page.
  const staleKey = `fh:{atenea-live}:record:${user}:expired`;
  await command('ZADD', 'fh:{atenea-live}:due', 0, staleKey);
  await store.due(now);
  assert.equal(await command('ZSCORE', 'fh:{atenea-live}:due', staleKey), null);
  // App login sessions use real Redis TTL/revocation and do not retain the upstream JWT.
  const sessions = new RedisIdentitySessions(client, async () => user, () => now);
  const identity = 'a'.repeat(64); const issued = await sessions.issue(identity, Date.now() + 300000);
  assert.ok(issued); const identityRequest = new Request('https://staging.test', { headers: { cookie: `${ACCESS_COOKIE}=${issued}` } });
  assert.equal((await sessions.lookup(identityRequest))!.user, identity);
  await sessions.revoke(identityRequest); assert.equal(await sessions.lookup(identityRequest), null);
  for (let i = 0; i < 9; i++) assert.ok(await sessions.issue(identity, Date.now() + 300000));
  assert.equal(await sessions.issue(identity, Date.now() + 300000), null);
  const missingOwner = `ci-missing-${crypto.randomUUID()}`;
  await store.reserve(missingOwner, 'lost-record', now);
  await command('DEL', `fh:{atenea-live}:record:${missingOwner}:lost-record`);
  await assert.rejects(store.active(missingOwner));
});
