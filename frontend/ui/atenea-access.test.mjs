import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { startLocalServer } from '../scripts/local-test-server.mjs';

let server, browser;
const url = 'https://abcdefghijklmnopqrst.supabase.co';
const user = '11111111-1111-4111-8111-111111111111';
const settings = {
  ATENEA_STAGING_IDENTITY_PROVIDER: 'supabase-staging', ATENEA_STAGING_ACCESS_ENABLED: 'true', ATENEA_STAGING_AUTH_REVIEWED: 'true',
  ATENEA_LOCAL_STAGING: 'true', ATENEA_SUPABASE_URL: url,
  ATENEA_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_123456789', ATENEA_STAGING_ALLOWED_SUBJECTS: user,
  ATENEA_PRODUCTION_SUPABASE_REFS: 'zzzzzzzzzzzzzzzzzzzz',
};
const prior = {};
before(async () => {
  // Process-local synthetic configuration. The server stays on loopback and Live is OFF.
  for (const [key, value] of Object.entries({ ...settings, ATENEA_LIVE_ENABLED: 'false' })) { prior[key] = process.env[key]; process.env[key] = value; }
  server = await startLocalServer(true);
  browser = await chromium.launch({ headless: true, ...(process.env.FH_UI_BROWSER_PATH ? { executablePath: process.env.FH_UI_BROWSER_PATH } : {}) });
}, { timeout: 60000 });
after(async () => {
  try { await browser?.close(); } finally {
    await server?.close();
    for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test('staging page has no microphone, disk session or voice calls; mocked SDK login is lost on reload', { timeout: 45000 }, async t => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    await context.addInitScript(() => {
      window.__accessWrites = []; window.__microphoneCalls = 0;
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) { window.__accessWrites.push({key, probe: key === value && /^lswt-/.test(key)}); return set.call(this, key, value); };
      navigator.mediaDevices.getUserMedia = async () => { window.__microphoneCalls++; throw new Error('No microphone in identity test'); };
    });
    await context.addCookies([{ name: 'preview-test-session', value: 'synthetic-preview-session', url: server.origin, httpOnly: true, sameSite: 'Lax' }]);
    const page = await context.newPage(), errors = [], modelCalls = [], providerCalls = [], accessCalls = [], consoleErrors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 200)); });
    page.on('request', request => { if (/api\.openai\.com|\/api\/atenea-voz\/session/.test(request.url())) modelCalls.push(request.url()); });
    const now = Math.floor(Date.now() / 1000);
    const token = [ { alg: 'ES256', typ: 'JWT', kid: 'synthetic' }, { sub: user, aud: 'authenticated', role: 'authenticated', iss: url + '/auth/v1', iat: now, exp: now + 3600,
      session_id: '22222222-2222-4222-8222-222222222222', is_anonymous: false } ].map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.') + '.' + Buffer.from('synthetic-signature').toString('base64url');
    // Mocked provider and authorization response: this validates UI/SDK lifecycle, not real identity.
    await page.route(url + '/**', route => {
      providerCalls.push({ method: route.request().method(), path: new URL(route.request().url()).pathname });
      const headers = { 'access-control-allow-origin': server.origin,
        'access-control-allow-headers': route.request().headers()['access-control-request-headers'] ?? '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
      if (route.request().method() === 'OPTIONS' || route.request().url().includes('/logout')) return route.fulfill({ status: 204, headers });
      return route.fulfill({ headers, contentType: 'application/json', body: JSON.stringify({ access_token: token, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600,
        user: { id: user, email: 'pilot@example.test', is_anonymous: false, email_confirmed_at: '2026-01-01', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01' } }) });
    });
    await page.route('**/api/atenea-voz/identity-check', async route => {
      accessCalls.push(route.request().method());
      const headers = await route.request().allHeaders();
      // Model private-preview protection: a missing same-origin cookie redirects before the app runs.
      if (!headers.cookie?.includes('preview-test-session=synthetic-preview-session')) {
        return route.fulfill({ status: 302, headers: { location: server.origin + '/preview-signin' } });
      }
      assert.equal(headers.authorization, `Bearer ${token}`);
      return route.fulfill({ contentType: 'application/json', body: '{"authorized":true}' });
    });
    await page.goto(server.origin + '/atenea-acceso');
    await page.getByRole('heading', { name: 'Acceso de prueba' }).waitFor();
    await page.getByLabel('Correo de prueba').fill('pilot@example.test');
    await page.getByLabel('Contraseña', { exact: true }).fill('synthetic-password');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes('Comprobando acceso'));
    if (!(await page.getByRole('status').innerText()).includes('Cuenta autorizada')) t.diagnostic(JSON.stringify({ providerCalls, accessCalls, errors, consoleErrors, nodeNow: now, browserNow: await page.evaluate(() => Math.floor(Date.now()/1000)) }));
    assert.match(await page.getByRole('status').innerText(), /Cuenta autorizada/);
    assert.equal(await page.getByLabel('Contraseña', { exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => window.__microphoneCalls), 0);
    assert.ok(await page.evaluate(() => window.__accessWrites.every(write => write.probe)));
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    assert.equal(await page.evaluate(() => document.cookie), '');
    await page.getByRole('button', { name: 'Cerrar acceso', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Acceso cerrado' }).waitFor();
    await page.getByLabel('Correo de prueba').fill('pilot@example.test');
    await page.getByLabel('Contraseña', { exact: true }).fill('synthetic-password');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Cuenta autorizada' }).waitFor();
    await page.reload(); await page.getByRole('button', { name: 'Entrar', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Cerrar acceso' }).count(), 0);
    assert.deepEqual(modelCalls, []); assert.deepEqual(errors, []);
    if (process.env.FH_UI_ARTIFACTS_DIR) {
      await mkdir(process.env.FH_UI_ARTIFACTS_DIR, { recursive: true });
      await page.screenshot({ path: `${process.env.FH_UI_ARTIFACTS_DIR}/atenea-access-mobile.png`, fullPage: true });
    }
  } finally { await context.close(); }
});

test('the real probe rejects missing identity and foreign origin without contacting the provider', async () => {
  const own = await fetch(server.origin + '/api/atenea-voz/identity-check', { method: 'POST', headers: { origin: server.origin } });
  assert.equal(own.status, 401); assert.equal(own.headers.get('cache-control'), 'no-store');
  const foreign = await fetch(server.origin + '/api/atenea-voz/identity-check', { method: 'POST', headers: { origin: 'https://untrusted.test' } });
  assert.equal(foreign.status, 403);
});
