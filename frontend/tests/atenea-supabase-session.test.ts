import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { generateKeyPair, SignJWT, jwtVerify } from 'jose';
import { stagingAuthenticator, stagingSubjectHash } from '../src/lib/atenea/stagingAuth';
import { accessRoute, ACCESS_COOKIE, accessCookie, type AppIdentity, type AccessDependencies } from '../src/lib/atenea/stagingAccess';

const origin = 'https://staging.test', url = 'https://abcdefghijklmnopqrst.supabase.co';
const users = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
async function fixture() {
  const keys = await generateKeyPair('ES256');
  const config = { origin, url, publishableKey: 'sb_publishable_synthetic_123456789', allowedSubjects: users };
  let providerAvailable = true;
  // Signature-verifying test double for remote getUser; no external account/API is used.
  const verify = stagingAuthenticator(config, async token => {
    if (!providerAvailable) return null;
    const { payload } = await jwtVerify(token, keys.publicKey, { issuer: url + '/auth/v1', audience: 'authenticated' });
    return { id: payload.sub!, is_anonymous: false, email_confirmed_at: '2026-01-01' };
  });
  const token = (subject: string) => new SignJWT({ role: 'authenticated', is_anonymous: false, session_id: '33333333-3333-4333-8333-333333333333' })
    .setProtectedHeader({ alg: 'ES256' }).setIssuer(url + '/auth/v1').setAudience('authenticated').setSubject(subject).setIssuedAt().setExpirationTime('15m').sign(keys.privateKey);
  const records = new Map<string, AppIdentity>();
  const deps: AccessDependencies = { enabled: true, origin, closeForUser: async () => true, sessions: {
    verify,
    lookup: async request => { const cookie = accessCookie(request), value = cookie ? records.get(cookie) : null; return value && value.expiresAt > Date.now() ? value : null; },
    issue: async (user, expiresAt) => { const cookie = randomBytes(32).toString('hex'); records.set(cookie, { user, expiresAt }); return cookie; },
    revoke: async request => { const cookie = accessCookie(request); if (cookie) records.delete(cookie); },
  } };
  const request = (method: string, jwt?: string, cookie?: string) => new Request(origin + '/api/atenea-voz/access', { method,
    headers: { origin, ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}), ...(cookie ? { cookie: `${ACCESS_COOKIE}=${cookie}` } : {}) } });
  const route = (request: Request) => accessRoute(request, deps, true, origin);
  return { deps, records, config, token, request, route, denyProvider: () => { providerAvailable = false; } };
}
const issuedCookie = (response: Response) => response.headers.get('set-cookie')!.match(/=([a-f0-9]{64});/)![1];

test('Supabase verified identity exchanges for an opaque cookie and renewal rotates/revokes its predecessor', async () => {
  const f = await fixture(), token = await f.token(users[0]);
  const first = await f.route(f.request('POST', token)); assert.equal(first.status, 200);
  const cookie = issuedCookie(first), record = f.records.get(cookie)!;
  assert.equal(record.user, stagingSubjectHash(f.config, users[0])); assert.ok(record.expiresAt <= Date.now() + 900000);
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/']) assert.ok(first.headers.get('set-cookie')!.includes(flag));
  assert.equal((await first.text()).includes(token), false);
  const renewal = await f.route(f.request('POST', token, cookie)); assert.equal(renewal.status, 200);
  const next = issuedCookie(renewal); assert.notEqual(next, cookie); assert.equal(f.records.has(cookie), false); assert.ok(f.records.has(next));
  assert.deepEqual(await (await f.route(f.request('GET', undefined, cookie))).json(), { authenticated: false });
});
test('two allowed accounts remain isolated and cannot silently replace each other using an existing cookie', async () => {
  const f = await fixture(), [one, two] = await Promise.all(users.map(f.token));
  const cookieOne = issuedCookie(await f.route(f.request('POST', one)));
  assert.equal((await f.route(f.request('POST', two, cookieOne))).status, 409);
  const cookieTwo = issuedCookie(await f.route(f.request('POST', two)));
  assert.notEqual(f.records.get(cookieOne)!.user, f.records.get(cookieTwo)!.user);
  let closed: string | undefined; f.deps.closeForUser = async user => { closed = user; return true; };
  const logout = await f.route(f.request('DELETE', undefined, cookieOne)); assert.equal(logout.status, 200);
  assert.equal(closed, stagingSubjectHash(f.config, users[0])); assert.equal(f.records.has(cookieOne), false); assert.ok(f.records.has(cookieTwo));
});
test('provider rejection and foreign subject cannot issue a cookie; unavailable persistence fails closed', async () => {
  const f = await fixture();
  assert.equal((await f.route(f.request('POST', await f.token('44444444-4444-4444-8444-444444444444')))).status, 401);
  f.denyProvider(); assert.equal((await f.route(f.request('POST', await f.token(users[0])))).status, 401); assert.equal(f.records.size, 0);
  const g = await fixture(); g.deps.sessions.issue = async () => { throw new Error('redis unavailable'); };
  const response = await g.route(g.request('POST', await g.token(users[0]))); assert.equal(response.status, 503); assert.equal(response.headers.has('set-cookie'), false);
});
test('turning creation OFF preserves authenticated logout and never reports an ambiguous close as confirmed', async () => {
  const f = await fixture(), token = await f.token(users[0]), cookie = issuedCookie(await f.route(f.request('POST', token)));
  f.deps.enabled = false; f.deps.closeForUser = async () => false;
  assert.equal((await accessRoute(f.request('POST', token, cookie), f.deps, false, origin)).status, 404);
  const response = await accessRoute(f.request('DELETE', undefined, cookie), f.deps, false, origin);
  assert.equal(response.status, 202); assert.equal((await response.json()).remoteConfirmed, false); assert.equal(f.records.has(cookie), false);
});
