import test from 'node:test';
import assert from 'node:assert/strict';
import { stagingAuthConfig, stagingRedisConfig } from '../src/lib/atenea/stagingConfig';
import { stagingAccessRoute, stagingAuthenticator } from '../src/lib/atenea/stagingAuth';
import { StagingAccess, pilotClientOptions, type PilotAuth } from '../src/lib/atenea/stagingClient';

const user = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const origin = 'https://atenea-staging.example.test';
const url = 'https://abcdefghijklmnopqrst.supabase.co';
const env = {
  ATENEA_STAGING_IDENTITY_PROVIDER: 'supabase-staging', ATENEA_STAGING_ACCESS_ENABLED: 'true', ATENEA_STAGING_AUTH_REVIEWED: 'true',
  VERCEL_ENV: 'preview', ATENEA_SUPABASE_URL: url, ATENEA_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_123456789',
  ATENEA_PRODUCTION_SUPABASE_REFS: 'zzzzzzzzzzzzzzzzzzzz', ATENEA_VOICE_ORIGIN: origin, ATENEA_STAGING_ALLOWED_SUBJECTS: user,
};
const config = stagingAuthConfig(env)!;
const request = (jwt = token(), site: string | null = origin) => new Request(origin + '/api/atenea-voz/identity-check', {
  method: 'POST', headers: { authorization: `Bearer ${jwt}`, ...(site ? { origin: site } : {}) },
});
// This deliberately unsigned fixture must only be trusted after the injected remote lookup succeeds.
function token(patch: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return [ { alg: 'ES256', typ: 'JWT' }, { iss: url + '/auth/v1', sub: user, aud: 'authenticated', role: 'authenticated',
    session_id: other, is_anonymous: false, iat: now, exp: now + 600, ...patch } ].map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.') + '.synthetic';
}

test('staging config is closed by default, in production, without review and without its private allowlist', () => {
  assert.ok(config);
  for (const patch of [{ ATENEA_STAGING_ACCESS_ENABLED: undefined }, { ATENEA_STAGING_AUTH_REVIEWED: 'false' },
    { VERCEL_ENV: 'production', ATENEA_LOCAL_STAGING: 'true' }, { VERCEL_ENV: undefined },
    { ATENEA_STAGING_ALLOWED_SUBJECTS: '' }, { ATENEA_STAGING_IDENTITY_PROVIDER: 'unknown' },
    { ATENEA_PRODUCTION_SUPABASE_REFS: '' }, { ATENEA_PRODUCTION_SUPABASE_REFS: 'abcdefghijklmnopqrst' }]) {
    assert.equal(stagingAuthConfig({ ...env, ...patch }), null);
  }
});
test('staging config rejects secret keys, arbitrary hosts, noncanonical origins and invalid subjects', () => {
  for (const patch of [{ ATENEA_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_never_publish' },
    { ATENEA_SUPABASE_URL: 'https://attacker.test' }, { ATENEA_SUPABASE_URL: url + '/' },
    { ATENEA_VOICE_ORIGIN: origin + '/' }, { ATENEA_VOICE_ORIGIN: 'http://attacker.test' },
    { ATENEA_STAGING_ALLOWED_SUBJECTS: 'anonymous' }, { ATENEA_STAGING_ALLOWED_SUBJECTS: Array(6).fill(user).join(',') }]) {
    assert.equal(stagingAuthConfig({ ...env, ...patch }), null);
  }
  assert.ok(stagingAuthConfig({ ...env, VERCEL_ENV: undefined, ATENEA_LOCAL_STAGING: 'true', ATENEA_VOICE_ORIGIN: 'http://127.0.0.1:3000' }));
});
test('remote identity and immutable server allowlist are required; user metadata never grants access', async () => {
  let calls = 0;
  const auth = stagingAuthenticator(config, async () => { calls++; return { id: user, is_anonymous: false, email_confirmed_at: '2026-01-01' }; });
  const id = await auth(request()); assert.match(id!, /^[a-f0-9]{64}$/); assert.notEqual(id, user);
  assert.equal(await auth(request(token({ exp: Math.floor(Date.now() / 1000) + 900 }))), id);
  assert.equal(await auth(request(token({ sub: other, user_metadata: { admin: true, scope: 'atenea:identity-check' } }))), null);
  assert.equal(calls, 2);
  assert.equal(await stagingAuthenticator(config, async () => null)(request()), null);
  assert.equal(await stagingAuthenticator(config, async () => ({ id: other, is_anonymous: false, email_confirmed_at: 'yes' }))(request()), null);
});
test('anonymous/unverified accounts and unavailable provider cannot authenticate', async () => {
  for (const lookup of [async () => ({ id: user, is_anonymous: true, email_confirmed_at: 'yes' }),
    async () => ({ id: user, is_anonymous: false }), async () => { throw new Error('private provider error'); }]) {
    assert.equal(await stagingAuthenticator(config, lookup)(request()), null);
  }
});
test('expired, wrong issuer/audience/role, future and oversized tokens fail before provider lookup', async () => {
  let calls = 0; const auth = stagingAuthenticator(config, async () => { calls++; return null; });
  const now = Math.floor(Date.now() / 1000);
  for (const patch of [{ exp: now - 1 }, { iss: 'https://other.supabase.co/auth/v1' }, { aud: 'other' },
    { role: 'service_role' }, { iat: now + 120 }, { exp: now + 7200 }, { session_id: 'missing' }, { is_anonymous: true }]) {
    assert.equal(await auth(request(token(patch))), null);
  }
  assert.equal(await auth(request('x'.repeat(9000))), null); assert.equal(calls, 0);
});
test('access HTTP gate rejects OFF, missing config, cross-origin, anonymous and bodies; success reveals no identity or token', async () => {
  const auth = async () => 'pseudonymous';
  assert.equal((await stagingAccessRoute(request(), false, config, auth)).status, 404);
  assert.equal((await stagingAccessRoute(request(), true, null)).status, 503);
  for (const site of ['https://other.test', null]) assert.equal((await stagingAccessRoute(request(token(), site), true, config, auth)).status, 403);
  assert.equal((await stagingAccessRoute(request(), true, config, async () => null)).status, 401);
  const body = new Request(request(), { body: '{}' });
  assert.equal((await stagingAccessRoute(body, true, config, auth)).status, 400);
  const response = await stagingAccessRoute(request(), true, config, auth);
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { authorized: true, scope: 'atenea:identity-check', mode: 'authentication-only' });
});

function clientFixture() {
  let session: { access_token: string; expires_at: number } | null = { access_token: 'original', expires_at: Date.now() / 1000 + 600 };
  let refreshed = 0, signedOut = 0, stopped = 0, calls = 0;
  const auth: PilotAuth = {
    login: async () => session, session: async () => session,
    refresh: async () => { refreshed++; return session = { access_token: 'refreshed', expires_at: Date.now() / 1000 + 600 }; },
    logout: async () => { signedOut++; session = null; }, stop: () => { stopped++; },
  };
  const http: typeof fetch = async (input, init) => {
    calls++; assert.equal(input, '/api/atenea-voz/identity-check'); assert.equal(init?.method, 'POST'); assert.equal(init.credentials, 'same-origin'); assert.equal(init.redirect, 'error');
    assert.equal('body' in init, false); return Response.json({ authorized: true });
  };
  return { auth, http, access: new StagingAccess(auth, http), expire: () => { session!.expires_at = Date.now() / 1000 + 10; },
    counts: () => ({ refreshed, signedOut, stopped, calls }) };
}
test('SDK session has no disk persistence or URL-token import; sign-in probes identity without voice calls', async () => {
  assert.equal(pilotClientOptions.auth.persistSession, false); assert.equal(pilotClientOptions.auth.detectSessionInUrl, false);
  const f = clientFixture(); await f.access.login('pilot@example.test', 'synthetic-password');
  assert.equal(f.counts().calls, 1); assert.equal(await f.access.token(), 'original'); await f.access.logout();
  await assert.rejects(f.access.token());
});
test('expiring tokens are renewed before use and unavailable/expired renewal fails closed', async () => {
  const f = clientFixture(); f.expire(); assert.equal(await f.access.token(), 'refreshed'); assert.equal(f.counts().refreshed, 1);
  const g = clientFixture(); g.expire(); g.auth.refresh = async () => null; await assert.rejects(g.access.token());
});
test('a denied authorization or private SDK error clears access and returns only a generic message', async () => {
  const f = clientFixture(); const access = new StagingAccess(f.auth, async () => Response.json({}, { status: 401 }));
  await assert.rejects(access.login('pilot@example.test', 'not-logged'), /No se pudo autorizar/); assert.equal(f.counts().signedOut, 1);
  f.auth.login = async () => { throw new Error('secret-private-password-must-not-escape'); };
  await assert.rejects(new StagingAccess(f.auth).login('x', 'y'), error => String(error).includes('No se pudo autorizar') && !String(error).includes('secret-private'));
});
test('leaving during a pending login cannot authorize late or retain auto-refresh', async () => {
  const f = clientFixture(); let finish!: () => void;
  f.auth.login = () => new Promise(resolve => { finish = () => resolve({ access_token: 'late', expires_at: Date.now() / 1000 + 600 }); });
  const pending = f.access.login('pilot@example.test', 'synthetic'); const rejected = assert.rejects(pending);
  f.access.stop(); finish(); await rejected;
  assert.equal(f.counts().calls, 0); assert.ok(f.counts().stopped >= 2); await assert.rejects(f.access.token());
});
test('duplicate sign-in cannot race the SDK identity or sign out the first attempt', async () => {
  const f = clientFixture(); let finish!: () => void;
  f.auth.login = () => new Promise(resolve => { finish = () => resolve({ access_token: 'original', expires_at: Date.now() / 1000 + 600 }); });
  const first = f.access.login('pilot@example.test', 'synthetic');
  await assert.rejects(f.access.login('other@example.test', 'synthetic'));
  assert.equal(f.counts().signedOut, 0); finish(); await first; await f.access.logout();
});
test('closing during a session lookup cannot initiate late token renewal', async () => {
  const f = clientFixture(); let finish!: () => void;
  f.auth.session = () => new Promise(resolve => { finish = () => resolve({ access_token: 'late', expires_at: Date.now() / 1000 + 1 }); });
  const pending = f.access.token(); const rejected = assert.rejects(pending);
  f.access.stop(); finish(); await rejected; assert.equal(f.counts().refreshed, 0);
});

test('cleanup configuration remains isolated after gates OFF, without authorizing new exchanges', () => {
  const off = { ...env, ATENEA_STAGING_ACCESS_ENABLED: 'false', ATENEA_STAGING_AUTH_REVIEWED: 'false' };
  assert.equal(stagingAuthConfig(off), null);
  assert.ok(stagingAuthConfig(off, true));
  assert.equal(stagingAuthConfig({ ...off, VERCEL_ENV: 'production', ATENEA_LOCAL_STAGING: 'true' }, true), null);
  assert.equal(stagingAuthConfig({ ...off, ATENEA_STAGING_IDENTITY_PROVIDER: 'unknown' }, true), null);
});
test('SDK exchange uses same-origin HttpOnly transport, validates server expiry and never forwards credentials in a body', async () => {
  const f = clientFixture(); let exchanges = 0;
  const app = new StagingAccess(f.auth, async (input, init) => {
    assert.equal(input, '/api/atenea-voz/access'); assert.equal(init?.method, 'POST');
    assert.equal(init.credentials, 'same-origin'); assert.equal(init.cache, 'no-store'); assert.equal(init.redirect, 'error');
    assert.equal(new Headers(init.headers).get('authorization'), 'Bearer original'); assert.equal('body' in init, false);
    exchanges++; return Response.json({ authenticated: true, expiresAt: Date.now() + 60000 });
  });
  assert.ok(await app.establish()); assert.equal(exchanges, 1);
  const failed = new StagingAccess(f.auth, async () => Response.json({ authenticated: true, expiresAt: Date.now() - 1 }));
  await assert.rejects(failed.establish());
});
test('before audio the renewed provider token must cover 600 seconds plus closure margin', async () => {
  const f = clientFixture(); let calls = 0;
  const app = new StagingAccess(f.auth, async () => { calls++; return Response.json({ authenticated: true, expiresAt: Date.now() + 300000 }); });
  // This SDK fixture can only obtain ten minutes: insufficient for the required 660 seconds.
  await assert.rejects(app.establish(660)); assert.equal(calls, 0); assert.equal(f.counts().refreshed, 1);
});
test('leaving during the app exchange cannot authorize a late response', async () => {
  const f = clientFixture(); let finish!: () => void;
  const app = new StagingAccess(f.auth, () => new Promise(resolve => { finish = () => resolve(Response.json({ authenticated: true, expiresAt: Date.now() + 60000 })); }));
  const pending = app.establish(); const rejected = assert.rejects(pending);
  while (!finish) await Promise.resolve(); app.stop(); finish(); await rejected;
});

test('staging Redis uses only dedicated integration credentials and rejects production or shared fallback', () => {
  const settings = { VERCEL_ENV: 'preview', ATENEA_STAGING_IDENTITY_PROVIDER: 'supabase-staging',
    ATENEA_KV_REST_API_URL: 'https://synthetic.upstash.io', ATENEA_KV_REST_API_TOKEN: 'synthetic-staging',
    UPSTASH_REDIS_REST_URL: 'https://production.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'synthetic-production' };
  assert.deepEqual(stagingRedisConfig(settings), { url: settings.ATENEA_KV_REST_API_URL, token: 'synthetic-staging' });
  for (const patch of [{ VERCEL_ENV: 'production' }, { ATENEA_STAGING_IDENTITY_PROVIDER: 'unknown' },
    { ATENEA_KV_REST_API_URL: '' }, { ATENEA_KV_REST_API_TOKEN: '' },
    { ATENEA_KV_REST_API_URL: 'http://synthetic.upstash.io' }, { ATENEA_KV_REST_API_URL: 'https://user:password@synthetic.upstash.io' },
    { ATENEA_KV_REST_API_URL: 'https://synthetic.upstash.io/path' }]) assert.equal(stagingRedisConfig({ ...settings, ...patch }), null);
});
