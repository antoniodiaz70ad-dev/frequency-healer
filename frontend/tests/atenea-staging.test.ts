import test from 'node:test';
import assert from 'node:assert/strict';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { accessTokenAuthenticator } from '../src/lib/atenea/liveAuth';
import { ACCESS_COOKIE, accessCookie, accessRoute, type AppIdentity, type IdentitySessions, type AccessDependencies } from '../src/lib/atenea/stagingAccess';

const origin = 'https://staging.test';
const hash = 'a'.repeat(64), cookie = 'b'.repeat(64);
const request = (method: string, headers: Record<string, string> = {}) => new Request(origin + '/api/atenea-voz/access', { method, headers: { origin, ...headers } });
async function fixture() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const verify = accessTokenAuthenticator({ keys: [{ ...await exportJWK(publicKey), kid: 'test' }] }, 'https://issuer.test', 'atenea');
  const token = await new SignJWT({ permissions: ['atenea:voice'], scope: 'atenea:voice' }).setProtectedHeader({ alg: 'RS256', kid: 'test' }).setIssuer('https://issuer.test').setAudience('atenea').setSubject('user').setIssuedAt().setExpirationTime('5m').sign(privateKey);
  const identity = await verify(request('POST', { Authorization: `Bearer ${token}` }));
  const records = new Map<string, AppIdentity>(); let revocations = 0;
  const sessions: IdentitySessions = {
    verify,
    lookup: async req => { const value = accessCookie(req); const record = value ? records.get(value) : null; return record && record.expiresAt > Date.now() ? record : null; },
    issue: async (user, expiresAt) => { records.set(cookie, { user, expiresAt, sessionId: cookie }); return cookie; },
    revoke: async req => { revocations++; const value = accessCookie(req); if (value && value !== cookie) records.delete(value); },
  };
  const deps: AccessDependencies = { enabled: true, origin, sessions, closeForUser: async () => true };
  return { deps, sessions, records, token, identity: identity!, revocations: () => revocations, route: (req: Request) => accessRoute(req, deps, true, origin) };
}
test('identity gate remains closed without flag/config and rejects cross-site exchange', async () => {
  const f = await fixture();
  assert.equal((await accessRoute(request('POST'), f.deps, false, origin)).status, 404);
  assert.equal((await accessRoute(request('POST'), null, true, origin)).status, 503);
  assert.equal((await f.route(request('POST', { origin: 'https://foreign.test' }))).status, 403);
  assert.equal((await f.route(request('POST', { 'sec-fetch-site': 'cross-site' }))).status, 403);
  assert.equal((await f.route(request('POST'))).status, 401);
});
test('verified JWT exchange returns opaque secure cookie, no JWT or identity in response', async () => {
  const f = await fixture(); const response = await f.route(request('POST', { Authorization: `Bearer ${f.token}` }));
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const header = response.headers.get('set-cookie')!;
  for (const attribute of ['Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/']) assert.ok(header.includes(attribute));
  assert.ok(header.startsWith(ACCESS_COOKIE + '=' + cookie)); assert.equal(header.includes(f.token), false);
  const data = await response.text(); assert.equal(data.includes(f.token), false); assert.equal(data.includes(f.identity), false);
  assert.ok(f.records.get(cookie)!.expiresAt <= Date.now() + 300000);
});
test('lookup reports expired/revoked session as signed out and does not reveal its owner', async () => {
  const f = await fixture(); f.records.set(cookie, { sessionId: cookie, user: hash, expiresAt: Date.now() - 1 });
  const expired = await f.route(request('GET', { cookie: `${ACCESS_COOKIE}=${cookie}` })); assert.deepEqual(await expired.json(), { authenticated: false });
  f.records.set(cookie, { sessionId: cookie, user: hash, expiresAt: Date.now() + 60000 });
  const status = await (await f.route(request('GET', { cookie: `${ACCESS_COOKIE}=${cookie}` }))).json(); assert.equal(status.authenticated, true); assert.equal('user' in status, false);
});
test('changing identity requires logout; refresh does not silently abandon another user audio', async () => {
  const f = await fixture(); f.records.set(cookie, { sessionId: cookie, user: 'other-user', expiresAt: Date.now() + 60000 });
  assert.equal((await f.route(request('POST', { Authorization: `Bearer ${f.token}`, cookie: `${ACCESS_COOKIE}=${cookie}` }))).status, 409);
  assert.equal(f.revocations(), 0);
});
test('logout revokes access even when remote closure is unconfirmed; works after flags off', async () => {
  const f = await fixture(); f.records.set(cookie, { sessionId: cookie, user: hash, expiresAt: Date.now() + 60000 });
  f.sessions.revoke = async req => { const value = accessCookie(req); if (value) f.records.delete(value); };
  f.deps.closeForUser = async user => { assert.equal(user, hash); return false; }; f.deps.enabled = false;
  const response = await accessRoute(request('DELETE', { cookie: `${ACCESS_COOKIE}=${cookie}` }), f.deps, false, origin);
  assert.equal(response.status, 202); assert.deepEqual(await response.json(), { authenticated: false, remoteConfirmed: false });
  assert.equal(f.records.size, 0); assert.ok(response.headers.get('set-cookie')!.includes('Max-Age=0'));
});
test('confirmed logout closes remote session; storage failures remain explicit and clear local cookie', async () => {
  const f = await fixture(); f.records.set(cookie, { sessionId: cookie, user: hash, expiresAt: Date.now() + 60000 });
  assert.equal((await f.route(request('DELETE', { cookie: `${ACCESS_COOKIE}=${cookie}` }))).status, 200);
  f.sessions.revoke = async () => { throw new Error('store down'); };
  const response = await f.route(request('DELETE', { cookie: `${ACCESS_COOKIE}=${cookie}` }));
  assert.equal(response.status, 503); assert.equal((await response.json()).revocationConfirmed, false);
  assert.ok(response.headers.get('set-cookie')!.includes('Max-Age=0'));
});
test('duplicate, malformed or attacker-chosen cookie names cannot fix an application session', () => {
  assert.equal(accessCookie(request('GET', { cookie: `${ACCESS_COOKIE}=bad` })), null);
  assert.equal(accessCookie(request('GET', { cookie: `${ACCESS_COOKIE}=${cookie}; ${ACCESS_COOKIE}=${cookie}` })), null);
  assert.equal(accessCookie(request('GET', { cookie: `other=${cookie}` })), null);
});
