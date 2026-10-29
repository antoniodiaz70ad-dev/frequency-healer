import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type WebSocket from 'ws';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { accessTokenAuthenticator } from '../src/lib/atenea/liveAuth';
import { liveSessionRoute } from '../src/lib/atenea/liveService';
import { OpenAILiveProvider } from '../src/lib/atenea/liveProvider';
import { reapLiveSessions } from '../src/lib/atenea/liveReaper';
import { accessRoute, type AccessDependencies } from '../src/lib/atenea/stagingAccess';
import { LIVE_CONSENT, type LiveDependencies, type LiveRecord, type LiveStore } from '../src/lib/atenea/liveTypes';

const origin = 'https://staging.example.test';
const requestId = '00000000-0000-4000-8000-000000000001';
const payload = { requestId, mode: 'observador', consent: LIVE_CONSENT, sdp: 'v=0\r\na=audio' };
const request = (data: unknown = payload, method = 'POST', headers: Record<string, string> = {}) => new Request(`${origin}/api/atenea-voz/session`, { method,
  headers: { origin, 'Content-Type': 'application/json', Authorization: 'Bearer user-a', ...headers }, body: JSON.stringify(data) });

/** Test-only atomic store, deliberately not a runtime fallback. */
class TestStore implements LiveStore {
  revoked = new Set<string>();
  records = new Map<string, LiveRecord>(); used = new Map<string, number>();
  async reserve(user: string, id: string, now: number, sessionId: string) {
    if (this.revoked.has(sessionId)) return false;
    if (this.records.has(user + id) || [...this.records.values()].some(record => record.user === user && !record.closed) || (this.used.get(user) ?? 0) >= 1800) return false;
    this.used.set(user, (this.used.get(user) ?? 0) + 600);
    this.records.set(user + id, { user, sessionId, requestId: id, closed: false, deadline: now + 600000 }); return true;
  }
  async bind(user: string, id: string, providerId: string) { const record = this.records.get(user + id)!; record.providerId = providerId; return !this.revoked.has(record.sessionId!); }
  async find(user: string, id: string) { return this.records.get(user + id) ?? null; }
  async finish(user: string, id: string) { this.records.get(user + id)!.closed = true; }
  async due(now: number) { return [...this.records.values()].filter(record => record.deadline <= now && !record.closed); }
}
function fixture() {
  const store = new TestStore(); let creates = 0, closes = 0;
  const deps: LiveDependencies = { origin, enabled: true, store,
    authenticate: async req => { const user = req.headers.get('authorization') === 'Bearer user-a' ? 'a' : req.headers.get('authorization') === 'Bearer user-b' ? 'b' : null; return user ? { user, sessionId: user.repeat(64), expiresAt: Date.now() + 300000 } : null; },
    provider: { create: async () => { creates++; return { id: 'live_opaque_123', sdp: 'v=0\r\nanswer' }; }, close: async () => { closes++; return true; } } };
  const route = (req: Request) => liveSessionRoute(req, deps, true, origin);
  return { store, deps, route, creates: () => creates, closes: () => closes };
}

test('logout 200 fences a previously authenticated create before its reservation', async () => {
  const f = fixture();
  let resume!: () => void, authenticated!: () => void;
  const waiting = new Promise<void>(resolve => { resume = resolve; });
  const captured = new Promise<void>(resolve => { authenticated = resolve; });
  const identity = { user: 'a', sessionId: 'a'.repeat(64), expiresAt: Date.now() + 300000 };
  f.deps.authenticate = async () => { authenticated(); await waiting; return identity; };
  const creation = f.route(request()); await captured;
  const access: AccessDependencies = { origin, enabled: false,
    sessions: { verify: async () => null, lookup: async () => identity, issue: async () => null,
      revoke: async () => { f.store.revoked.add(identity.sessionId); } },
    closeForUser: async () => ![...f.store.records.values()].some(record => !record.closed),
  };
  const logout = await accessRoute(new Request(origin, { method: 'DELETE', headers: { origin } }), access, false, origin);
  assert.equal(logout.status, 200); assert.equal((await logout.json()).remoteConfirmed, true);
  resume(); assert.equal((await creation).status, 429); assert.equal(f.creates(), 0);
});

test('logout during provider create stays unconfirmed and fences the late result, retaining failed closure', async () => {
  for (const closeSucceeds of [true, false]) {
    const f = fixture();
    let resume!: () => void, entered!: () => void;
    const waiting = new Promise<void>(resolve => { resume = resolve; });
    const creating = new Promise<void>(resolve => { entered = resolve; });
    f.deps.provider.create = async () => { entered(); await waiting; return { id: 'live_late_logout', sdp: 'v=0' }; };
    f.deps.provider.close = async () => closeSucceeds;
    const creation = f.route(request()); await creating;
    const identity = { user: 'a', sessionId: 'a'.repeat(64), expiresAt: Date.now() + 300000 };
    const access: AccessDependencies = { origin, enabled: false,
      sessions: { verify: async () => null, lookup: async () => identity, issue: async () => null,
        revoke: async () => { f.store.revoked.add(identity.sessionId); } },
      closeForUser: async () => ![...f.store.records.values()].some(record => !record.closed),
    };
    const logout = await accessRoute(new Request(origin, { method: 'DELETE', headers: { origin } }), access, false, origin);
    assert.equal(logout.status, 202); assert.equal((await logout.json()).remoteConfirmed, false);
    resume(); const response = await creation;
    assert.equal(response.status, 409); assert.equal((await response.json()).confirmed, closeSucceeds);
    const record = await f.store.find('a', requestId); assert.equal(record!.closed, closeSucceeds);
    assert.equal(record!.providerId, 'live_late_logout');
  }
});

test('real endpoint rejects disabled configuration, foreign origin, missing identity and oversized inputs without provider spend', async () => {
  const f = fixture();
  assert.equal((await liveSessionRoute(request(), f.deps, false, origin)).status, 404);
  assert.equal((await liveSessionRoute(request(), null, true, origin)).status, 503);
  assert.equal((await f.route(request(payload, 'POST', { origin: 'https://evil.test' }))).status, 403);
  assert.equal((await f.route(request(payload, 'POST', { Authorization: '' }))).status, 401);
  assert.equal((await f.route(request({ ...payload, sdp: 'v=0' + 'x'.repeat(70000) }))).status, 400);
  assert.equal(f.creates(), 0);
});
test('input cannot choose model, URL, hosted delegation or reuse local simulation consent', async () => {
  const f = fixture();
  for (const extra of [{ model: 'expensive' }, { url: 'https://evil.test' }, { delegation: { type: 'responses' } }, { consent: 'simulation' }]) {
    assert.equal((await f.route(request({ ...payload, ...extra }))).status, 400);
  }
  assert.equal(f.creates(), 0);
});
test('concurrent creates and replay reserve exactly one billable session', async () => {
  const f = fixture(); const results = await Promise.all([f.route(request()), f.route(request())]);
  assert.deepEqual(results.map(result => result.status).sort(), [201, 429]);
  assert.equal(f.creates(), 1); assert.equal(f.store.used.get('a'), 600);
  const ok = results.find(result => result.status === 201)!; assert.equal(ok.headers.get('cache-control'), 'no-store');
  assert.equal(JSON.stringify(await ok.json()).includes('Bearer'), false);
});
test('ownership, confirmed close, idempotent close and daily reservation cap', async () => {
  const f = fixture(); await f.route(request());
  assert.equal((await f.route(request({ requestId }, 'DELETE', { Authorization: 'Bearer user-b' }))).status, 404);
  assert.equal(f.closes(), 0);
  for (let i = 0; i < 3; i++) {
    const id = requestId.slice(0, -1) + (i + 1);
    if (i) assert.equal((await f.route(request({ ...payload, requestId: id }))).status, 201);
    assert.equal((await f.route(request({ requestId: id }, 'DELETE'))).status, 200);
    assert.equal((await f.route(request({ requestId: id }, 'DELETE'))).status, 200);
  }
  assert.equal(f.closes(), 3);
  assert.equal((await f.route(request({ ...payload, requestId: requestId.slice(0, -1) + '4' }))).status, 429);
});
test('ambiguous create and unconfirmed close keep persistent reservation, block new spending', async () => {
  const f = fixture(); f.deps.provider.create = async () => { throw new Error('timeout possibly created'); };
  assert.equal((await f.route(request())).status, 502);
  assert.equal((await f.route(request({ ...payload, requestId: requestId.slice(0, -1) + '2' }))).status, 429);
  assert.equal(f.store.used.get('a'), 600);
  assert.equal((await f.route(request({ requestId }, 'DELETE'))).status, 409);
  const g = fixture(); await g.route(request()); g.deps.provider.close = async () => false;
  assert.equal((await g.route(request({ requestId }, 'DELETE'))).status, 202);
  assert.equal((await g.store.find('a', requestId))!.closed, false);
});
test('durable store failure prevents provider creation; bind failure attempts remote cleanup', async () => {
  const f = fixture(); f.store.reserve = async () => { throw new Error('redis unavailable'); };
  assert.equal((await f.route(request())).status, 503); assert.equal(f.creates(), 0);
  const g = fixture(); g.store.bind = async () => { throw new Error('redis unavailable'); };
  assert.equal((await g.route(request())).status, 503); assert.equal(g.closes(), 1);
});
test('cancel during quota reservation prevents provider spend; cancel during create closes a late session', async () => {
  const f = fixture(); const abort = new AbortController();
  const reserve = f.store.reserve.bind(f.store);
  f.store.reserve = async (...args) => { const reserved = await reserve(...args); abort.abort(); return reserved; };
  const req = new Request(request(), { signal: abort.signal });
  assert.equal((await f.route(req)).status, 408); assert.equal(f.creates(), 0);
  const g = fixture(); const lateAbort = new AbortController();
  g.deps.provider.create = async () => { lateAbort.abort(); return { id: 'live_late', sdp: 'v=0' }; };
  assert.equal((await g.route(new Request(request(), { signal: lateAbort.signal }))).status, 408);
  assert.equal(g.closes(), 1); assert.equal((await g.store.find('a', requestId))!.closed, true);
});
test('emergency flag stops creation but does not prevent authenticated cleanup', async () => {
  const f = fixture(); await f.route(request()); f.deps.enabled = false;
  assert.equal((await liveSessionRoute(request({ requestId }, 'DELETE'), f.deps, false, origin)).status, 200);
});
test('watchdog requires its own credential and retries only sessions without confirmed close', async () => {
  const f = fixture(); await f.route(request()); (await f.store.find('a', requestId))!.deadline = 0;
  const secret = 'synthetic-reaper-test-only-credential';
  assert.equal((await reapLiveSessions(request(), f.deps, secret)).status, 401);
  const cleanup = () => reapLiveSessions(request({}, 'POST', { Authorization: `Bearer ${secret}` }), f.deps, secret);
  f.deps.provider.close = async () => false; await cleanup(); assert.equal((await f.store.due(Date.now())).length, 1);
  f.deps.provider.close = async () => true; await cleanup(); assert.equal((await f.store.due(Date.now())).length, 0);
});
test('provider request uses documented Live shape, restricts browser commands and strips response extras', async () => {
  let calls = 0;
  const provider = new OpenAILiveProvider('synthetic-test-only', async (url, init) => {
    calls++; assert.equal(url, 'https://api.openai.com/v1/live/sessions');
    const data = JSON.parse(String(init?.body));
    assert.equal(data.session.model, 'gpt-live-1'); assert.equal(data.session.store, false);
    assert.equal(data.session.delegation.type, 'client'); assert.equal(data.transport.type, 'webrtc');
    assert.equal(data.session.client.data_channel.allowed_client_events.includes('session.update'), false);
    return Response.json({ session: { id: 'live_keep_prefix' }, transport: { type: 'webrtc', sdp: 'v=0\r\nanswer' }, client_secret: 'must-not-escape' });
  });
  assert.deepEqual(await provider.create('v=0', 'diario', 'hash'), { id: 'live_keep_prefix', sdp: 'v=0\r\nanswer' }); assert.equal(calls, 1);
  const failing = new OpenAILiveProvider('synthetic-test-only', async () => { calls++; throw new Error('unreachable'); });
  await assert.rejects(failing.create('v=0', 'diario', 'hash')); assert.equal(calls, 2);
});
test('signed identity enforces issuer, audience, expiry, scope, signature and pseudonymous subject', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(publicKey), kid: 'test' };
  const authenticate = accessTokenAuthenticator({ keys: [jwk] }, 'https://issuer.test', 'atenea-staging');
  const token = (claims: Record<string, unknown> = {}) => new SignJWT({ permissions: ['atenea:voice'], scope: 'atenea:voice', ...claims }).setProtectedHeader({ alg: 'RS256', kid: 'test' }).setIssuer('https://issuer.test').setAudience('atenea-staging').setSubject('private-user').setIssuedAt().setExpirationTime('5m').sign(privateKey);
  const valid = await token(); const user = await authenticate(request({}, 'POST', { Authorization: `Bearer ${valid}` }));
  assert.match(user!, /^[a-f0-9]{64}$/); assert.notEqual(user, 'private-user');
  assert.equal(await authenticate(request({}, 'POST', { Authorization: `Bearer ${valid.slice(0, -12)}invalid` })), null);
  const noScope = await token({ scope: 'other' }); assert.equal(await authenticate(request({}, 'POST', { Authorization: `Bearer ${noScope}` })), null);
  const noPermission = await token({ permissions: [] });
  assert.equal(await authenticate(request({}, 'POST', { Authorization: `Bearer ${noPermission}` })), null,
    'An authenticated subject requesting the scope is not necessarily an authorized tester');
  for (const kind of ['issuer', 'audience', 'expiry']) {
    const builder = new SignJWT({ permissions: ['atenea:voice'], scope: 'atenea:voice' }).setProtectedHeader({ alg: 'RS256', kid: 'test' }).setSubject('private-user').setIssuedAt()
      .setIssuer(kind === 'issuer' ? 'https://evil.test' : 'https://issuer.test').setAudience(kind === 'audience' ? 'other' : 'atenea-staging').setExpirationTime(kind === 'expiry' ? Math.floor(Date.now() / 1000) - 30 : '5m');
    assert.equal(await authenticate(request({}, 'POST', { Authorization: `Bearer ${await builder.sign(privateKey)}` })), null);
  }
});
test('static JWKS rotation requires explicit overlap and retirement; removed keys fail closed', async () => {
  const old = await generateKeyPair('RS256'), next = await generateKeyPair('RS256');
  const oldJwk = { ...await exportJWK(old.publicKey), kid: 'old' };
  const nextJwk = { ...await exportJWK(next.publicKey), kid: 'next' };
  const issue = (pair: typeof old, kid: string) => new SignJWT({ scope: 'atenea:voice', permissions: ['atenea:voice'] })
    .setProtectedHeader({ alg: 'RS256', kid }).setIssuer('https://issuer.test').setAudience('atenea-staging')
    .setSubject('tester').setIssuedAt().setExpirationTime('5m').sign(pair.privateKey);
  const oldToken = await issue(old, 'old'), nextToken = await issue(next, 'next');
  const validate = (keys: typeof oldJwk[]) => accessTokenAuthenticator({ keys }, 'https://issuer.test', 'atenea-staging');
  const check = (token: string) => request({}, 'POST', { Authorization: `Bearer ${token}` });
  assert.ok(await validate([oldJwk])(check(oldToken)));
  assert.equal(await validate([oldJwk])(check(nextToken)), null);
  assert.ok(await validate([oldJwk, nextJwk])(check(oldToken)));
  assert.ok(await validate([oldJwk, nextJwk])(check(nextToken)));
  assert.equal(await validate([nextJwk])(check(oldToken)), null);
  assert.ok(await validate([nextJwk])(check(nextToken)));
});
test('server sideband closes only after session.closed, never treats socket loss as confirmation', async () => {
  for (const success of [true, false]) {
    const socket = new EventEmitter() as EventEmitter & { send(data: string): void; terminate(): void };
    let terminated = false;
    socket.terminate = () => { terminated = true; };
    socket.send = data => { assert.equal(JSON.parse(data).type, 'session.close'); queueMicrotask(() => success ? socket.emit('message', Buffer.from('{"type":"session.closed"}')) : socket.emit('close')); };
    const provider = new OpenAILiveProvider('synthetic-test', fetch, (url, options) => {
      assert.equal(url, 'wss://api.openai.com/v1/live/sessions/live_opaque/attach');
      assert.equal(options.headers?.Authorization, 'Bearer synthetic-test');
      queueMicrotask(() => socket.emit('open')); return socket as unknown as WebSocket;
    });
    assert.equal(await provider.close('live_opaque'), success); assert.equal(terminated, true);
  }
});
