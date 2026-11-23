import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { startLocalServer } from '../scripts/local-test-server.mjs';

// Auth and storage endpoints are synthetic in this browser test. Live RLS is
// verified separately in the dedicated database; no CI test calls production.
const enabled = process.env.NEXT_PUBLIC_COMPOSER_SUPABASE_URL === 'https://composer-test.invalid';
test('private composer account: explicit activation, two phone profiles, automatic saves, offline retry and sign-out', { timeout: 90000, skip: !enabled }, async () => {
  const server = await startLocalServer(false);
  let browser;
  try { browser = await chromium.launch({ headless: true, args: ['--mute-audio'], ...(process.env.FH_UI_BROWSER_PATH ? { executablePath: process.env.FH_UI_BROWSER_PATH } : process.env.FH_UI_BROWSER === 'chromium' ? {} : { channel: 'chrome' }) }); }
  catch (error) { await server.close(); throw error; }
  const contexts = [], errors = [];
  const userId = '00000000-0000-4000-8000-000000000011';
  let row = null, writes = 0, offline = false;
  const user = { id: userId, email: 'owner@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: '2026-11-23T10:00:00Z' };
  const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url')}.synthetic-signature`;
  const auth = { access_token: jwt, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user };
  async function phone() {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); contexts.push(context);
    await context.route('https://composer-test.invalid/**', async route => {
      const request = route.request(), url = new URL(request.url()), method = request.method();
      const respond = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (url.pathname.endsWith('/otp')) return respond({});
      if (url.pathname.endsWith('/verify')) return respond(auth);
      if (url.pathname.endsWith('/user')) return respond(user);
      if (url.pathname.endsWith('/logout')) return respond({});
      if (url.pathname.endsWith('/token')) return respond(auth);
      if (!url.pathname.endsWith('/fh_composer_v1')) return respond({ error: 'unexpected endpoint' }, 400);
      if (offline) return route.abort('internetdisconnected');
      if (method === 'GET') return respond(row ? { revision: row.revision, payload: row.payload } : null);
      const incoming = request.postDataJSON();
      if (method === 'POST') {
        if (row) return respond({ code: '23505', message: 'exists' }, 409);
        row = incoming; writes++; return respond(null, 201);
      }
      if (method === 'PATCH') {
        if (!row || url.searchParams.get('revision') !== `eq.${row.revision}`) return respond(null);
        row = { ...row, ...incoming }; writes++; return respond({ revision: row.revision });
      }
      return respond({ error: 'unexpected method' }, 400);
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(server.origin + '/marina-punto-cero/compositor'); return page;
  }
  async function enter(page) {
    await page.getByLabel('Correo de mi cuenta', { exact: true }).fill(user.email);
    await page.getByRole('button', { name: 'Recibir código de acceso', exact: true }).click();
    await page.getByLabel('Código del correo', { exact: true }).fill('123456');
    await page.getByRole('button', { name: 'Verificar código', exact: true }).click();
    await page.getByRole('button', { name: 'Activar sincronización y combinar mis datos', exact: true }).waitFor();
    assert.equal(writes, 0, 'sign-in alone does not upload browser data');
    await page.getByRole('button', { name: 'Activar sincronización y combinar mis datos', exact: true }).click();
    await page.getByRole('status').filter({ hasText: /^Sincronizado$/ }).waitFor();
  }
  try {
    const first = await phone();
    await first.getByLabel('Nombre de la composición', { exact: true }).fill('Mi receta portátil');
    await first.getByLabel('Modulación de capa 1 (Hz)', { exact: true }).fill('0.32789');
    await first.getByRole('button', { name: 'Guardar receta', exact: true }).click();
    await enter(first); assert.equal(row.payload.compositions.length, 1);
    const writesBeforeSecond = writes;
    const second = await phone();
    await second.getByLabel('Correo de mi cuenta', { exact: true }).fill(user.email);
    await second.getByRole('button', { name: 'Recibir código de acceso', exact: true }).click();
    await second.getByLabel('Código del correo', { exact: true }).fill('123456');
    await second.getByRole('button', { name: 'Verificar código', exact: true }).click();
    await second.getByRole('button', { name: 'Activar sincronización y combinar mis datos', exact: true }).click();
    await second.getByRole('button', { name: 'Cargar Mi receta portátil', exact: true }).waitFor();
    assert.equal(writes, writesBeforeSecond, 'reading an identical cloud document does not write it again');
    await second.getByRole('button', { name: 'Cargar Mi receta portátil', exact: true }).click();
    assert.equal(await second.getByLabel('Modulación de capa 1 (Hz)', { exact: true }).inputValue(), '0.32789');
    offline = true;
    await second.getByLabel('Modulación de capa 1 (Hz)', { exact: true }).fill('0.3879');
    await second.getByRole('button', { name: 'Guardar cambios de receta', exact: true }).click();
    await second.getByRole('alert').filter({ hasText: /No se pudo leer/ }).waitFor();
    assert.equal(row.payload.compositions[0].recipe.layers[0].rateHz, .32789);
    offline = false;
    await second.getByRole('button', { name: 'Sincronizar ahora', exact: true }).click();
    await second.getByRole('status').filter({ hasText: /^Sincronizado$/ }).waitFor();
    await first.getByRole('button', { name: 'Sincronizar ahora', exact: true }).click();
    await first.getByRole('status').filter({ hasText: /^Sincronizado$/ }).waitFor();
    assert.equal(row.payload.compositions.length, 1);
    assert.equal(row.payload.compositions[0].recipe.layers[0].rateHz, .3879);
    await second.getByRole('button', { name: 'Cerrar mi sesión', exact: true }).click();
    await second.getByLabel('Correo de mi cuenta', { exact: true }).waitFor();
    assert.equal(await second.getByRole('button', { name: 'Cargar Mi receta portátil', exact: true }).count(), 1);
    assert.equal(await second.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
  } finally { for (const context of contexts) await context.close(); await browser.close(); await server.close(); }
});
