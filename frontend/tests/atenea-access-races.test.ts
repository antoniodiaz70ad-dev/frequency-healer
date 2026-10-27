import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { accessTokenAuthenticator } from '../src/lib/atenea/liveAuth';
import { RedisLiveStore } from '../src/lib/atenea/liveStore';
import { liveSessionRoute } from '../src/lib/atenea/liveService';
import { reapLiveSessions } from '../src/lib/atenea/liveReaper';
import { LIVE_CONSENT, type LiveDependencies } from '../src/lib/atenea/liveTypes';
import { ACCESS_COOKIE, accessRoute, cookieLiveAccess, RedisIdentitySessions, type AccessDependencies } from '../src/lib/atenea/stagingAccess';
import { redisTestClient } from './helpers/redisClient';

const redisOnly = { skip: !process.env.ATENEA_TEST_REDIS_PORT, timeout: 15000 };
const origin = 'https://staging.test';
const keypair = generateKeyPair('RS256');
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { resolve, promise };
}
async function fixture() {
  const { client, command } = redisTestClient();
  const { publicKey, privateKey } = await keypair;
  const verify = accessTokenAuthenticator({ keys: [{ ...await exportJWK(publicKey), kid: 'fixture' }] }, 'https://issuer.test', 'atenea');
  const sessions = new RedisIdentitySessions(client, verify), store = new RedisLiveStore(client);
  const subject = crypto.randomUUID();
  const token = (sub = subject) => new SignJWT({ scope: 'atenea:voice' }).setProtectedHeader({ alg: 'RS256', kid: 'fixture' })
    .setIssuer('https://issuer.test').setAudience('atenea').setSubject(sub).setJti(crypto.randomUUID()).setIssuedAt().setExpirationTime('5m').sign(privateKey);
  let creates = 0, closes = 0;
  const deps: LiveDependencies = { origin, enabled: true, store, ...cookieLiveAccess(sessions, store),
    provider: { create: async () => { creates++; return { id: 'live_test', sdp: 'v=0\r\nanswer' }; }, close: async () => { closes++; return true; } },
  };
  const access: AccessDependencies = { enabled: true, origin, sessions, closeForUser: async user => {
    const active = await store.active(user);
    if (!active || active.closed) return true;
    if (!active.providerId) return false;
    const confirmed = await deps.provider.close(active.providerId);
    if (confirmed) await store.finish(user, active.requestId);
    return confirmed;
  } };
  const req = (method: string, cookie = '', bearer = '') => new Request(origin + '/api/atenea-voz/access', {
    method, headers: { origin, ...(cookie ? { cookie: `${ACCESS_COOKIE}=${cookie}` } : {}), ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
  });
  const exchange = (bearer: string, cookie = '') => accessRoute(req('POST', cookie, bearer), access, true, origin);
  const logout = (cookie: string) => accessRoute(req('DELETE', cookie), access, false, origin);
  const upstream = await token(), signedIn = await exchange(upstream);
  assert.equal(signedIn.status, 200);
  const cookie = signedIn.headers.get('set-cookie')!.split(';')[0].split('=')[1];
  const identity = (await sessions.lookup(req('GET', cookie)))!;
  const id = crypto.randomUUID();
  const payload = { requestId: id, mode: 'observador', consent: LIVE_CONSENT, sdp: 'v=0\r\na=audio' };
  const voice = () => new Request(origin + '/api/atenea-voz/session', { method: 'POST',
    headers: { origin, 'Content-Type': 'application/json', cookie: `${ACCESS_COOKIE}=${cookie}` }, body: JSON.stringify(payload) });
  const route = (request: Request) => liveSessionRoute(request, deps, true, origin);
  return { client, command, sessions, store, deps, access, req, exchange, logout, upstream, token, cookie, identity, id, payload, voice, route,
    creates: () => creates, closes: () => closes };
}

test('logout while the request body is pending prevents any provider creation or quota reservation', redisOnly, async () => {
  const f = await fixture(), authenticated = deferred<void>();
  const authenticate = f.deps.authenticate;
  f.deps.authenticate = async req => { const user = await authenticate(req); authenticated.resolve(); return user; };
  let body!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({ start(controller) { body = controller; } });
  const request = new Request(f.voice().url, { method: 'POST', headers: f.voice().headers, body: stream, duplex: 'half' } as RequestInit);
  const pending = f.route(request);
  await authenticated.promise;
  const logout = await f.logout(f.cookie);
  assert.equal(logout.status, 200);
  assert.deepEqual(await logout.json(), { authenticated: false, revocationConfirmed: true, remoteConfirmed: true });
  body.enqueue(new TextEncoder().encode(JSON.stringify(f.payload))); body.close();
  assert.equal((await pending).status, 401);
  assert.equal(f.creates(), 0); assert.equal(await f.store.active(f.identity.user), null);
});

test('logout during admitted creation reports uncertainty and closes its late result without returning SDP', redisOnly, async () => {
  for (const closeConfirmed of [true, false]) {
    const f = await fixture(), started = deferred<void>(), completion = deferred<{ id: string; sdp: string }>();
    f.deps.provider.create = async () => { started.resolve(); return completion.promise; };
    f.deps.provider.close = async () => closeConfirmed;
    const pending = f.route(f.voice()); await started.promise;
    const logout = await f.logout(f.cookie);
    assert.equal(logout.status, 202);
    assert.deepEqual(await logout.json(), { authenticated: false, revocationConfirmed: true, remoteConfirmed: false });
    completion.resolve({ id: 'live_late', sdp: 'v=0\r\nprivate-answer' });
    const result = await pending;
    assert.equal(result.status, 401);
    const data = await result.json(); assert.equal(data.remoteConfirmed, closeConfirmed); assert.equal('transport' in data, false);
    assert.equal((await f.store.find(f.identity.user, f.id))!.closed, closeConfirmed);
    if (!closeConfirmed) {
      await f.command('ZADD', 'fh:{atenea-live}:due', 0, `fh:{atenea-live}:record:${f.identity.user}:${f.id}`);
      f.deps.enabled = false; f.deps.provider.close = async () => true;
      const secret = 'synthetic-reaper-test-only-credential';
      const reaped = await reapLiveSessions(new Request(origin, { headers: { Authorization: `Bearer ${secret}` } }), f.deps, secret);
      assert.equal(reaped.status, 200); assert.equal((await f.store.find(f.identity.user, f.id))!.closed, true);
    }
  }
});

test('a previous cookie can revoke a concurrent replacement; neither cookie nor the used JWT can reopen it', redisOnly, async () => {
  const f = await fixture(), refreshedToken = await f.token();
  const rotated = await f.exchange(refreshedToken, f.cookie);
  assert.equal(rotated.status, 200);
  const replacement = rotated.headers.get('set-cookie')!.split(';')[0].split('=')[1];
  assert.equal(await f.sessions.lookup(f.req('GET', f.cookie)), null);
  assert.ok(await f.sessions.lookup(f.req('GET', replacement)));
  assert.equal((await f.logout(f.cookie)).status, 200);
  assert.equal(await f.sessions.lookup(f.req('GET', replacement)), null);
  assert.equal((await f.exchange(refreshedToken, replacement)).status, 409);
  assert.equal((await f.exchange(f.upstream)).status, 409);
  assert.equal((await f.exchange(refreshedToken)).status, 409);
  assert.equal((await f.exchange(await f.token(crypto.randomUUID()))).status, 200);
});

test('Redis serializes renewal versus logout in either order and refuses stale reservation authority', redisOnly, async () => {
  for (let i = 0; i < 6; i++) {
    const f = await fixture(), authority = (await f.sessions.authority(f.req('GET', f.cookie)))!;
    const refreshed = await f.token();
    const [rotation, logout] = await Promise.all([f.exchange(refreshed, f.cookie), f.logout(f.cookie)]);
    assert.ok([200, 409].includes(rotation.status)); assert.equal(logout.status, 200);
    if (rotation.status === 200) {
      const replacement = rotation.headers.get('set-cookie')!.split(';')[0].split('=')[1];
      assert.equal(await f.sessions.lookup(f.req('GET', replacement)), null);
    }
    assert.equal(await f.store.reserveForSession(authority, f.identity.user, f.id, Date.now()), 'unauthorized');
    assert.equal(await f.store.active(f.identity.user), null);
  }
});

test('voice runtime rejects bearer-only access, preserves account isolation and bounds session expiry', redisOnly, async () => {
  const f = await fixture();
  const bearerOnly = new Request(f.voice(), { headers: { origin, 'Content-Type': 'application/json', Authorization: `Bearer ${f.upstream}` } });
  assert.equal((await f.route(bearerOnly)).status, 401); assert.equal(f.creates(), 0);
  assert.equal((await f.exchange(await f.token(crypto.randomUUID()), f.cookie)).status, 409);
  const authority = (await f.sessions.authority(f.req('GET', f.cookie)))!;
  assert.equal(await f.store.reserveForSession(authority, 'f'.repeat(64), f.id, Date.now()), 'unauthorized');
  assert.equal(await f.store.reserveForSession(authority, f.identity.user, f.id, f.identity.expiresAt + 1), 'unauthorized');
  const raw = await f.command('GET', authority.identityKey);
  assert.equal(raw.includes(f.upstream), false); assert.equal(raw.includes(f.cookie), false);
  const grant = createHash('sha256').update(f.upstream).digest('hex');
  assert.ok(await f.command('TTL', `fh:{atenea-live}:grant:${grant}`) <= 3600);
  const future = new RedisIdentitySessions(f.client, f.sessions.verify, () => f.identity.expiresAt + 1);
  assert.equal(await future.lookup(f.req('GET', f.cookie)), null);
});

test('a storage failure during the final authorization check still closes the created session', redisOnly, async () => {
  const f = await fixture(); let checks = 0;
  const authorized = f.deps.creationAuthorized;
  f.deps.creationAuthorized = async (...args) => { if (++checks === 2) throw new Error('store unavailable'); return authorized(...args); };
  const result = await f.route(f.voice());
  assert.equal(result.status, 401); assert.equal(f.creates(), 1); assert.equal(f.closes(), 1);
  assert.equal((await f.store.find(f.identity.user, f.id))!.closed, true);
});
