import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { startLocalServer } from '../scripts/local-test-server.mjs';

let server, browser;
const url = 'https://abcdefghijklmnopqrst.supabase.co';
const user = '11111111-1111-4111-8111-111111111111';
const settings = { ATENEA_STAGING_IDENTITY_PROVIDER: 'supabase-staging', ATENEA_STAGING_ACCESS_ENABLED: 'true', ATENEA_STAGING_AUTH_REVIEWED: 'true',
  ATENEA_STAGING_SESSION_ENABLED: 'true', ATENEA_LOCAL_STAGING: 'true', ATENEA_SUPABASE_URL: url,
  ATENEA_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_123456789', ATENEA_STAGING_ALLOWED_SUBJECTS: user,
  ATENEA_PRODUCTION_SUPABASE_REFS: 'zzzzzzzzzzzzzzzzzzzz', ATENEA_VOICE_ENABLED: 'false', ATENEA_STAGING_ENABLED: 'false', ATENEA_LIVE_ENABLED: 'false' };
const prior = {};
before(async () => {
  for (const [key, value] of Object.entries(settings)) { prior[key] = process.env[key]; process.env[key] = value; }
  server = await startLocalServer(true);
  browser = await chromium.launch({ headless: true, ...(process.env.FH_UI_BROWSER_PATH ? { executablePath: process.env.FH_UI_BROWSER_PATH } : {}) });
}, { timeout: 60000 });
after(async () => { try { await browser?.close(); } finally { await server?.close();
  for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
} });

test('SDK login exchanges application cookie, renews, logs out and loses provider session on reload while voice stays OFF', { timeout: 45000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    await context.addInitScript(() => { window.__mic = 0; navigator.mediaDevices.getUserMedia = async () => { window.__mic++; throw new Error('Voice must stay OFF'); }; });
    const page = await context.newPage(), errors = [], voiceCalls = []; let exchanges = 0, deletes = 0, authorized = false;
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/api\.openai\.com|\/api\/atenea-voz\/session/.test(request.url())) voiceCalls.push(request.url()); });
    const now = Math.floor(Date.now()/1000);
    const token = [{alg:'ES256',typ:'JWT'},{sub:user,iss:url+'/auth/v1',aud:'authenticated',role:'authenticated',iat:now,exp:now+3600}]
      .map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.')+'.'+Buffer.from('synthetic').toString('base64url');
    // Only the browser lifecycle is mocked here. Domain tests verify the auth/cookie contract separately.
    await page.route(url+'/**', route => {
      const headers = { 'access-control-allow-origin': server.origin, 'access-control-allow-headers': route.request().headers()['access-control-request-headers'] ?? '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
      return route.fulfill(route.request().method()==='OPTIONS'||route.request().url().includes('/logout') ? {status:204,headers} : {headers,contentType:'application/json',body:JSON.stringify({access_token:token,refresh_token:'synthetic-refresh',expires_in:3600,expires_at:now+3600,token_type:'bearer',user:{id:user,email:'pilot@example.test'}})});
    });
    await page.route('**/api/atenea-voz/identity-check', route => route.fulfill({contentType:'application/json',body:'{"authorized":true}'}));
    await page.route('**/api/atenea-voz/access', route => {
      const method = route.request().method();
      if(method==='POST') { assert.ok(route.request().headers().authorization?.startsWith('Bearer ')); assert.equal(route.request().postData(), null); exchanges++; authorized=true; }
      if(method==='DELETE') { deletes++; authorized=false; }
      return route.fulfill({contentType:'application/json',body:JSON.stringify(method==='DELETE'?{authenticated:false,remoteConfirmed:true}:{authenticated:authorized,expiresAt:Date.now()+3500000}),
        ...(method==='POST'?{headers:{'set-cookie':`__Host-atenea-session=${'a'.repeat(64)}; Path=/; Secure; HttpOnly; SameSite=Strict`}}:method==='DELETE'?{headers:{'set-cookie':'__Host-atenea-session=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0'}}:{})});
    });
    await page.goto(server.origin+'/atenea-voz/pruebas');
    await page.getByRole('heading',{name:'Prueba de conversación remota'}).waitFor();
    await page.getByLabel('Correo de prueba').fill('pilot@example.test'); await page.getByLabel('Contraseña',{exact:true}).fill('synthetic-password');
    await page.getByRole('button',{name:'Entrar a pruebas',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Sesión de aplicación verificada'}).waitFor(); assert.equal(exchanges,1);
    const cookies = await context.cookies(); assert.equal(cookies.length,1); assert.equal(cookies[0].httpOnly,true); assert.equal(cookies[0].secure,true);
    assert.equal(await page.evaluate(()=>document.cookie),'');
    assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
    await page.getByRole('button',{name:'Renovar acceso',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Acceso renovado'}).waitFor(); assert.equal(exchanges,2);
    await page.getByLabel(/Autorizo enviar audio/).check(); assert.equal(await page.getByRole('button',{name:'Iniciar prueba remota',exact:true}).isDisabled(),true);
    if(process.env.FH_UI_ARTIFACTS_DIR) { await mkdir(process.env.FH_UI_ARTIFACTS_DIR,{recursive:true}); await page.screenshot({path:process.env.FH_UI_ARTIFACTS_DIR+'/atenea-session-login.png',fullPage:true}); }
    await page.getByRole('button',{name:'Cerrar acceso de pruebas',exact:true}).click(); await page.getByRole('status').filter({hasText:'Acceso cerrado'}).waitFor(); assert.ok(deletes>=1);
    await page.reload(); await page.getByRole('button',{name:'Entrar a pruebas',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.__mic),0); assert.deepEqual(voiceCalls,[]); assert.deepEqual(errors,[]);
  } finally { await context.close(); }
});
test('real application endpoint fails closed without Redis even when the identity page is configured', async () => {
  const response = await fetch(server.origin+'/api/atenea-voz/access',{method:'POST',headers:{origin:server.origin}});
  assert.equal(response.status,503); assert.equal(response.headers.has('set-cookie'),false);
});
