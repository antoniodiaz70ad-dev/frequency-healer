import test from 'node:test';
import assert from 'node:assert/strict';
import { redisTestClient } from './helpers/redisClient';
import { RedisLiveStore } from '../src/lib/atenea/liveStore';
import { ACCESS_COOKIE, RedisIdentitySessions } from '../src/lib/atenea/stagingAccess';

/** Real Redis integration in CI; no production credentials or remote URLs are accepted. */
test('Redis Lua reservations serialize concurrent workers, reject replays, enforce owner and budget, retain unresolved close', {
  skip: !process.env.ATENEA_TEST_REDIS_PORT,
}, async () => {
  const { client, command } = redisTestClient();
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
  const identity = crypto.randomUUID().replaceAll('-', '').repeat(2);
  const issued = await sessions.issue(identity, Date.now() + 300000, null, crypto.randomUUID().replaceAll('-', '').repeat(2));
  assert.ok('cookie' in issued); const identityRequest = new Request('https://staging.test', { headers: { cookie: `${ACCESS_COOKIE}=${issued.cookie}` } });
  assert.equal((await sessions.lookup(identityRequest))!.user, identity);
  await sessions.revoke(identityRequest); assert.equal(await sessions.lookup(identityRequest), null);
  for (let i = 0; i < 9; i++) assert.ok('cookie' in await sessions.issue(identity, Date.now() + 300000, null, crypto.randomUUID().replaceAll('-', '').repeat(2)));
  assert.deepEqual(await sessions.issue(identity, Date.now() + 300000, null, crypto.randomUUID().replaceAll('-', '').repeat(2)), { error: 'limited' });
  const missingOwner = `ci-missing-${crypto.randomUUID()}`;
  await store.reserve(missingOwner, 'lost-record', now);
  await command('DEL', `fh:{atenea-live}:record:${missingOwner}:lost-record`);
  await assert.rejects(store.active(missingOwner));
});
