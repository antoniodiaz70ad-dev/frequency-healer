import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startLocalServer } from '../scripts/local-test-server.mjs';

let server, browser;
const url = 'https://abcdefghijklmnopqrst.supabase.co', email = 'pilot@example.test', password = 'synthetic-invite-password';
const user = { id: '11111111-1111-4111-8111-111111111111', email, is_anonymous: false,
  email_confirmed_at: '2026-10-28', app_metadata: {}, user_metadata: {}, created_at: '2026-10-28' };
const settings = {
  ATENEA_STAGING_IDENTITY_PROVIDER: 'supabase-staging', ATENEA_STAGING_ACCESS_ENABLED: 'true', ATENEA_STAGING_AUTH_REVIEWED: 'true',
  ATENEA_STAGING_INVITATION_ENABLED: 'true', ATENEA_LOCAL_STAGING: 'true', ATENEA_SUPABASE_URL: url,
  ATENEA_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_123456789', ATENEA_STAGING_ALLOWED_SUBJECTS: '',
  ATENEA_PRODUCTION_SUPABASE_REFS: 'zzzzzzzzzzzzzzzzzzzz', ATENEA_LIVE_ENABLED: 'false',
};
const prior = {};
before(async () => {
  for (const [key, value] of Object.entries(settings)) { prior[key] = process.env[key]; process.env[key] = value; }
  server = await startLocalServer(true);
  browser = await chromium.launch({ headless: true, ...(process.env.FH_UI_BROWSER_PATH ? { executablePath: process.env.FH_UI_BROWSER_PATH } : {}) });
}, { timeout: 60000 });
after(async () => {
  try { await browser?.close(); } finally {
    await server?.close();
    for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
async function setup(mode = 'success') {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    window.__writes = []; window.__audio = 0;
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { window.__writes.push({ key, probe: key === value && /^lswt-/.test(key) }); return set.call(this, key, value); };
    navigator.mediaDevices.getUserMedia = async () => { window.__audio++; throw new Error('No audio in invitation'); };
  });
  const page = await context.newPage(), calls = [], prohibited = [], logs = [];
  let logoutCalls = 0, release, started;
  const verificationStarted = new Promise(resolve => { started = resolve; });
  page.on('request', r => { if (/\/api\/atenea-voz\/|api\.openai\.com/.test(r.url())) prohibited.push(r.url()); });
  page.on('console', m => logs.push(m.text())); page.on('pageerror', e => logs.push(e.message));
  const now = Math.floor(Date.now() / 1000);
  const accessToken = [ { alg: 'HS256', typ: 'JWT' }, { sub: user.id, exp: now + 3600, aud: 'authenticated', role: 'authenticated' } ]
    .map(part => Buffer.from(JSON.stringify(part)).toString('base64url')).join('.') + '.c3ludGhldGlj';
  // Controlled transport checks SDK calls/UI only, not real OTP expiry/replay/identity guarantees.
  await page.route(url + '/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname, method = req.method();
    const headers = { 'access-control-allow-origin': server.origin, 'access-control-allow-headers': req.headers()['access-control-request-headers'] ?? '*',
      'access-control-allow-methods': 'GET, POST, PUT, OPTIONS' };
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers });
    calls.push({ path, method });
    const json = body => route.fulfill({ headers, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/auth/v1/verify' && method === 'POST') {
      assert.equal(req.postDataJSON().type, 'invite'); assert.equal(req.postDataJSON().email, email); assert.equal(req.postDataJSON().token, '123456');
      if (mode === 'deny') return route.fulfill({ status: 403, headers, contentType: 'application/json', body: '{"message":"private-provider-OTP-message","error_code":"otp_expired"}' });
      if (mode === 'late') await new Promise(resolve => { release = resolve; started(); });
      return json({ access_token: accessToken, refresh_token: 'synthetic-invitation-refresh', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user });
    }
    if (path === '/auth/v1/user' && method === 'GET') return json(user);
    if (path === '/auth/v1/user' && method === 'PUT') { assert.equal(req.postDataJSON().password, password); return json(user); }
    if (path === '/auth/v1/logout' && method === 'POST') {
      assert.equal(new URL(req.url()).searchParams.get('scope'), 'local'); logoutCalls++;
      if (mode === 'logout-fails' && logoutCalls === 1) return route.fulfill({ status: 500, headers, contentType: 'application/json', body: '{"message":"private-logout-error"}' });
      return route.fulfill({ status: 204, headers });
    }
    throw new Error(`Unexpected SDK operation: ${method} ${path}`);
  });
  return { context, page, calls, prohibited, logs, release: () => release?.(), verificationStarted,
    async verify() {
      await page.getByLabel('Correo invitado').fill(email); await page.getByLabel('Código de invitación').fill('123456');
      await page.getByRole('button', { name: 'Confirmar código', exact: true }).click();
    },
    async save() {
      await page.getByLabel('Nueva contraseña', { exact: true }).fill(password);
      await page.getByLabel('Repite la contraseña', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'Guardar contraseña', exact: true }).click();
    },
    async safe() {
      assert.deepEqual(prohibited, []); assert.equal(await page.evaluate(() => window.__audio), 0);
      assert.ok(await page.evaluate(() => window.__writes.every(w => w.probe)));
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
      assert.deepEqual(await context.cookies(), []);
      assert.ok(!logs.some(value => value.includes(accessToken) || /123456|synthetic-invite-password|synthetic-invitation-refresh|private-provider|private-logout/.test(value)));
      assert.equal(new URL(page.url()).search, ''); assert.equal(new URL(page.url()).hash, '');
    } };
}
test('invite SDK completes verification, password and local logout without granting voice or app access', { timeout: 45000 }, async () => {
  const f = await setup();
  try {
    await f.page.goto(server.origin + '/atenea-acceso/activar'); await f.page.getByRole('heading', { name: 'Activa tu cuenta' }).waitFor();
    assert.equal(f.calls.length, 0); await f.verify(); await f.page.getByLabel('Nueva contraseña', { exact: true }).waitFor();
    assert.equal(await f.page.getByLabel('Código de invitación').count(), 0);
    await f.save(); await f.page.getByRole('status').filter({ hasText: 'Cuenta preparada' }).waitFor();
    assert.ok(f.calls.some(c => c.method === 'PUT')); assert.ok(f.calls.some(c => c.path.endsWith('/logout')));
    assert.equal(await f.page.getByLabel('Nueva contraseña', { exact: true }).count(), 0); await f.safe();
    await f.page.reload(); await f.page.getByRole('button', { name: 'Confirmar código', exact: true }).waitFor();
    assert.equal(await f.page.getByLabel('Nueva contraseña', { exact: true }).count(), 0);
    assert.equal((await fetch(server.origin + '/atenea-acceso')).status, 404); // No UUID allowlist yet.
  } finally { await f.context.close(); }
});
test('rejected invite clears the code and reveals no provider error or password form', { timeout: 30000 }, async () => {
  const f = await setup('deny');
  try {
    await f.page.goto(server.origin + '/atenea-acceso/activar'); await f.verify();
    await f.page.getByRole('status').filter({ hasText: 'No se pudo confirmar' }).waitFor();
    assert.equal(await f.page.getByLabel('Código de invitación').inputValue(), '');
    assert.equal(await f.page.getByLabel('Nueva contraseña', { exact: true }).count(), 0); await f.safe();
  } finally { await f.context.close(); }
});
test('late verification after leaving cannot show password entry or call updateUser', { timeout: 30000 }, async () => {
  const f = await setup('late');
  try {
    await f.page.goto(server.origin + '/atenea-acceso/activar'); await f.verify(); await f.verificationStarted;
    await f.page.getByRole('button', { name: 'Salir del alta', exact: true }).click();
    // The provider response is withheld until the user has cancelled.
    const closed = f.page.waitForResponse(r => r.url().includes('/auth/v1/logout')); f.release();
    await closed;
    assert.match(await f.page.getByRole('status').innerText(), /Alta cerrada/);
    assert.ok(!f.calls.some(c => c.method === 'PUT')); await f.safe();
  } finally { f.release(); await f.context.close(); }
});
test('logout failure is not shown as success and can be retried without a second password write', { timeout: 30000 }, async () => {
  const f = await setup('logout-fails');
  try {
    await f.page.goto(server.origin + '/atenea-acceso/activar'); await f.verify(); await f.page.getByLabel('Nueva contraseña', { exact: true }).waitFor();
    await f.save(); await f.page.getByRole('status').filter({ hasText: 'no se pudo confirmar el cierre' }).waitFor();
    assert.equal(await f.page.getByRole('link', { name: 'Ir al acceso de prueba' }).count(), 0);
    await f.page.getByRole('button', { name: 'Reintentar cierre', exact: true }).click();
    await f.page.getByRole('status').filter({ hasText: 'Cuenta preparada' }).waitFor();
    assert.equal(f.calls.filter(c => c.method === 'PUT').length, 1); await f.safe();
  } finally { await f.context.close(); }
});
test('invitation route is closed when its independent flag is OFF', { timeout: 30000 }, async () => {
  process.env.ATENEA_STAGING_INVITATION_ENABLED = 'false'; let off;
  try { off = await startLocalServer(true); assert.equal((await fetch(off.origin + '/atenea-acceso/activar')).status, 404); }
  finally { process.env.ATENEA_STAGING_INVITATION_ENABLED = 'true'; await off?.close(); }
});
