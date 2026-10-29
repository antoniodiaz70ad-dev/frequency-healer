import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Redis } from '@upstash/redis';
import { RedisLiveStore } from '../src/lib/atenea/liveStore';
import { createHash } from 'node:crypto';
import { accessRoute } from '../src/lib/atenea/stagingAccess';
import { liveSessionRoute } from '../src/lib/atenea/liveService';
import { reapLiveSessions } from '../src/lib/atenea/liveReaper';
import { LIVE_CONSENT, type LiveDependencies } from '../src/lib/atenea/liveTypes';
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
  const store = new RedisLiveStore(client); const user = createHash('sha256').update(crypto.randomUUID()).digest('hex'); const now = Date.now();
  const access = new RedisIdentitySessions(client, async () => user);
  const token = await access.issue(user, now + 300000); assert.ok(token);
  const sessionId = createHash('sha256').update(token).digest('hex');
  const reservations = await Promise.all(Array.from({ length: 12 }, (_, i) => store.reserve(user, `request-${i}`, now, sessionId)));
  assert.equal(reservations.filter(Boolean).length, 1);
  const id = `request-${reservations.indexOf(true)}`;
  await store.bind(user, id, 'live_ci');
  assert.equal(await store.find('another-user', id), null);
  assert.equal(await store.reserve(user, 'blocked', now, sessionId), false);
  assert.equal((await store.due(now + 600001)).some(record => record.user === user), true);
  await store.finish(user, id); await store.finish(user, id);
  assert.equal((await store.find(user, id))!.closed, true);
  assert.equal(await store.reserve(user, id, now, sessionId), false);
  for (const next of ['second', 'third']) { assert.equal(await store.reserve(user, next, now, sessionId), true); await store.finish(user, next); }
  assert.equal(await store.reserve(user, 'over-budget', now, sessionId), false);
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
  const missingOwner = createHash('sha256').update(crypto.randomUUID()).digest('hex');
  const missingToken = await access.issue(missingOwner, now + 300000); assert.ok(missingToken);
  await store.reserve(missingOwner, 'lost-record', now, createHash('sha256').update(missingToken).digest('hex'));
  await command('DEL', `fh:{atenea-live}:record:${missingOwner}:lost-record`);
  await assert.rejects(store.active(missingOwner));
  // HTTP-level deterministic race using the same real Redis Lua scripts as runtime.
  const origin = 'https://staging.test';
  const raceUser = createHash('sha256').update(crypto.randomUUID()).digest('hex');
  const raceToken = await access.issue(raceUser, Date.now() + 300000); assert.ok(raceToken);
  const headers = { origin, cookie: `${ACCESS_COOKIE}=${raceToken}`, 'content-type': 'application/json' };
  const probe = new Request(origin, { headers });
  const raceIdentity = await access.lookup(probe); assert.ok(raceIdentity);
  let release!: () => void, entered!: () => void, closes = 0;
  const providerEntered = new Promise<void>(resolve => { entered = resolve; });
  const providerRelease = new Promise<void>(resolve => { release = resolve; });
  const deps: LiveDependencies = { origin, enabled: true, store, authenticate: async () => raceIdentity,
    provider: { create: async () => { entered(); await providerRelease; return { id: 'live_late_redis', sdp: 'v=0' }; }, close: async () => { closes++; return true; } } };
  const creation = liveSessionRoute(new Request(origin, { method: 'POST', headers, body: JSON.stringify({ requestId: crypto.randomUUID(), consent: LIVE_CONSENT, mode: 'observador', sdp: 'v=0' }) }), deps, true, origin);
  await Promise.race([providerEntered, creation.then(response => { throw new Error('Provider was never reached: HTTP ' + response.status); })]);
  const logout = await accessRoute(new Request(origin, { method: 'DELETE', headers }), { origin, enabled: false, sessions: access,
    closeForUser: async user => { const active = await store.active(user); return !active || active.closed; } }, false, origin);
  assert.equal(logout.status, 202); assert.equal((await logout.json()).remoteConfirmed, false);
  assert.equal((await store.due(Date.now())).some(record => record.user === raceUser && !record.providerId), true);
  assert.equal(await store.reserve(raceUser, crypto.randomUUID(), Date.now(), raceIdentity.sessionId), false);
  release(); assert.equal((await creation).status, 409); assert.equal(closes, 1);
  assert.equal(await store.active(raceUser), null);
  // Authentication completed before logout, but reservation begins after logout's 200.
  const secondUser = createHash('sha256').update(crypto.randomUUID()).digest('hex');
  const secondToken = await access.issue(secondUser, Date.now() + 300000); assert.ok(secondToken);
  const secondRequest = new Request(origin, { method: 'DELETE', headers: { origin, cookie: `${ACCESS_COOKIE}=${secondToken}` } });
  const snapshot = await access.lookup(secondRequest); assert.ok(snapshot);
  const secondLogout = await accessRoute(secondRequest, { origin, enabled: false, sessions: access, closeForUser: async () => true }, false, origin);
  assert.equal(secondLogout.status, 200);
  assert.equal(await store.reserve(secondUser, crypto.randomUUID(), Date.now(), snapshot.sessionId), false);
  // Real Redis queue fairness: 25 ambiguous creates must not hide later known IDs.
  const batch = [];
  for (let i = 0; i < 26; i++) {
    const owner = createHash('sha256').update(crypto.randomUUID()).digest('hex');
    const record = { user: owner, requestId: crypto.randomUUID(), closed: false, deadline: i,
      ...(i === 25 ? { providerId: 'live_after_unknown_batch' } : {}) };
    const recordKey = `fh:{atenea-live}:record:${owner}:${record.requestId}`;
    await command('SET', recordKey, JSON.stringify(record));
    await command('ZADD', 'fh:{atenea-live}:due', i, recordKey); batch.push(record);
  }
  const secret = 'synthetic-redis-scheduler-test-only';
  const sweep = () => reapLiveSessions(new Request(origin, { headers: { authorization: `Bearer ${secret}` } }), deps, secret);
  assert.deepEqual(await (await sweep()).json(), { processed: 25, confirmed: 0 });
  assert.deepEqual(await (await sweep()).json(), { processed: 1, confirmed: 1 });
  assert.equal(closes, 2);
  const last = batch[25]; assert.equal((await store.find(last.user, last.requestId))!.closed, true);
  // A deferred retry after another worker finished must not resurrect the sorted-set entry.
  await store.defer(last.user, last.requestId, 0);
  assert.equal(await command('ZSCORE', 'fh:{atenea-live}:due', `fh:{atenea-live}:record:${last.user}:${last.requestId}`), null);
  for (const pending of batch.slice(0, 25)) {
    assert.equal((await store.find(pending.user, pending.requestId))!.closed, false);
    assert.equal(await command('TTL', `fh:{atenea-live}:record:${pending.user}:${pending.requestId}`), -1);
  }
});
