import test from 'node:test';
import assert from 'node:assert/strict';
import { StagingInvitation, invitationClientOptions, type InvitationAuth, type InvitationIdentity } from '../src/lib/atenea/stagingInvitation';
import { stagingAuthConfig, stagingInvitationConfig } from '../src/lib/atenea/stagingConfig';

const identity = { id: '11111111-1111-4111-8111-111111111111', email: 'pilot@example.test', email_confirmed_at: '2026-10-28', is_anonymous: false };
const env = {
  ATENEA_STAGING_IDENTITY_PROVIDER: 'supabase-staging', ATENEA_STAGING_ACCESS_ENABLED: 'true', ATENEA_STAGING_AUTH_REVIEWED: 'true',
  ATENEA_STAGING_INVITATION_ENABLED: 'true', VERCEL_ENV: 'preview',
  ATENEA_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', ATENEA_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_123456789',
  ATENEA_PRODUCTION_SUPABASE_REFS: 'zzzzzzzzzzzzzzzzzzzz', ATENEA_VOICE_ORIGIN: 'https://staging.example.test',
};
function fixture() {
  let verifies = 0, reads = 0, writes = 0, logouts = 0;
  const auth: InvitationAuth = {
    verify: async (email, code) => { verifies++; assert.equal(email, identity.email); assert.equal(code, '123456'); return identity; },
    currentUser: async () => { reads++; return identity; },
    setPassword: async () => { writes++; return identity; },
    logout: async () => { logouts++; }, stop: () => {},
  };
  return { auth, client: new StagingInvitation(auth), counts: () => ({ verifies, reads, writes, logouts }) };
}
test('invitation can prepare credentials before the UUID allowlist exists, but never authorizes app access', () => {
  assert.ok(stagingInvitationConfig(env)); assert.equal(stagingAuthConfig(env), null);
  for (const patch of [{ ATENEA_STAGING_INVITATION_ENABLED: 'false' }, { ATENEA_STAGING_AUTH_REVIEWED: 'false' },
    { ATENEA_STAGING_ACCESS_ENABLED: 'false' }, { VERCEL_ENV: 'production', ATENEA_LOCAL_STAGING: 'true' },
    { ATENEA_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_forbidden' }, { ATENEA_PRODUCTION_SUPABASE_REFS: 'abcdefghijklmnopqrst' },
    { ATENEA_SUPABASE_URL: 'https://external.test' }, { ATENEA_VOICE_ORIGIN: 'https://staging.example.test/' }]) {
    assert.equal(stagingInvitationConfig({ ...env, ...patch }), null);
  }
  assert.equal(invitationClientOptions.auth.persistSession, false);
  assert.equal(invitationClientOptions.auth.detectSessionInUrl, false);
  assert.equal(invitationClientOptions.auth.autoRefreshToken, false);
});
test('password writes require explicit invite verification and a matching remotely confirmed user', async () => {
  const f = fixture(); await assert.rejects(f.client.savePassword('synthetic-password'));
  await f.client.verify('PILOT@example.test', '123456'); await f.client.savePassword('synthetic-password');
  assert.deepEqual(f.counts(), { verifies: 1, reads: 1, writes: 1, logouts: 0 });
  await assert.rejects(f.client.savePassword('another-password')); await f.client.close();
  await assert.rejects(f.client.verify(identity.email, '123456'));
});
test('malformed codes and emails never contact the provider', async () => {
  const f = fixture();
  for (const [email, code] of [['bad-email', '123456'], [identity.email, '12345'], [identity.email, '123456?token=x'], [identity.email, '12345678901']]) {
    await assert.rejects(f.client.verify(email, code));
  }
  assert.equal(f.counts().verifies, 0);
});
test('unconfirmed, anonymous or mismatched provider users cannot progress; private errors stay private', async () => {
  for (const result of [null, { ...identity, email_confirmed_at: undefined }, { ...identity, is_anonymous: true }, { ...identity, email: 'other@example.test' }]) {
    const f = fixture(); f.auth.verify = async () => result;
    await assert.rejects(f.client.verify(identity.email, '123456'), /No se pudo confirmar la invitación/);
    await assert.rejects(f.client.savePassword('synthetic-password')); assert.equal(f.counts().writes, 0);
  }
  const f = fixture(); f.auth.verify = async () => { throw new Error('private OTP or provider error'); };
  await assert.rejects(f.client.verify(identity.email, '123456'), error => !String(error).includes('private OTP'));
});
test('identity change, revocation and provider outage between verification and password write fail closed', async () => {
  for (const lookup of [async () => null, async () => ({ ...identity, id: '22222222-2222-4222-8222-222222222222' }),
    async () => { throw new Error('private-provider-error'); }]) {
    const f = fixture(); await f.client.verify(identity.email, '123456'); f.auth.currentUser = lookup;
    await assert.rejects(f.client.savePassword('synthetic-password'), /No se pudo confirmar el guardado/);
    assert.equal(f.counts().writes, 0);
  }
});
test('short or oversized passwords are rejected before a network request', async () => {
  const f = fixture(); await f.client.verify(identity.email, '123456');
  for (const password of ['short', 'x'.repeat(129)]) await assert.rejects(f.client.savePassword(password));
  assert.equal(f.counts().reads, 0); assert.equal(f.counts().writes, 0);
});
test('closing during verification cleans a late SDK session and prevents password writes', async () => {
  const f = fixture(); let finish!: (user: InvitationIdentity) => void;
  f.auth.verify = () => new Promise(resolve => { finish = resolve; });
  const pending = f.client.verify(identity.email, '123456'), rejected = assert.rejects(pending);
  await f.client.close(); finish(identity); await rejected;
  await assert.rejects(f.client.savePassword('synthetic-password')); assert.equal(f.counts().writes, 0); assert.ok(f.counts().logouts >= 2);
});
test('closing during the remote user check cannot start a late password write', async () => {
  const f = fixture(); await f.client.verify(identity.email, '123456'); let finish!: (user: InvitationIdentity) => void;
  f.auth.currentUser = () => new Promise(resolve => { finish = resolve; });
  const pending = f.client.savePassword('synthetic-password'), rejected = assert.rejects(pending);
  await f.client.close(); finish(identity); await rejected; assert.equal(f.counts().writes, 0);
});
test('duplicate verification neither changes identity nor signs out the first pending attempt', async () => {
  const f = fixture(); let finish!: (user: InvitationIdentity) => void;
  f.auth.verify = () => new Promise(resolve => { finish = resolve; });
  const pending = f.client.verify(identity.email, '123456');
  await assert.rejects(f.client.verify('other@example.test', '654321')); assert.equal(f.counts().logouts, 0);
  finish(identity); await pending; await f.client.savePassword('synthetic-password'); assert.equal(f.counts().writes, 1);
});
test('an uncertain password write can be retried; failed logout is reported and can also be retried', async () => {
  const f = fixture(); await f.client.verify(identity.email, '123456'); let attempts = 0;
  f.auth.setPassword = async () => { if (++attempts === 1) throw new Error('provider-private-timeout'); return identity; };
  await assert.rejects(f.client.savePassword('synthetic-password'), /No se pudo confirmar/);
  await f.client.savePassword('synthetic-password'); let closes = 0;
  f.auth.logout = async () => { if (++closes === 1) throw new Error('private-logout-error'); };
  await assert.rejects(f.client.close(), /No se pudo confirmar el cierre/);
  await f.client.close(); assert.equal(closes, 2); await assert.rejects(f.client.savePassword('synthetic-password'));
});
test('an in-flight password change is not presented as rolled back when the page closes', async () => {
  const f = fixture(); await f.client.verify(identity.email, '123456'); let finish!: (user: InvitationIdentity) => void;
  f.auth.setPassword = () => new Promise(resolve => { finish = resolve; });
  const pending = f.client.savePassword('synthetic-password'), rejected = assert.rejects(pending, /No se pudo confirmar/);
  while (!finish) await Promise.resolve(); await f.client.close(); finish(identity); await rejected;
  assert.ok(f.counts().logouts >= 2);
});
test('the verified invitation expires locally after ten minutes without refreshing it to write a password', async () => {
  const f = fixture(); let now = 1000; const client = new StagingInvitation(f.auth, () => now);
  await client.verify(identity.email, '123456'); now += 600000;
  await assert.rejects(client.savePassword('synthetic-password')); assert.equal(f.counts().reads, 0); assert.equal(f.counts().writes, 0);
});
