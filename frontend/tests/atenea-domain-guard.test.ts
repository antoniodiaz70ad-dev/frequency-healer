import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ATENEA_STAGING_BRANCH,
  ATENEA_STAGING_HOST,
  isPublicStagingPath,
  stagingDomainDecision,
  stagingDomainGuardReady,
} from '../src/lib/atenea/domainGuard';

const stagingEnv = {
  VERCEL_ENV: 'preview',
  VERCEL_GIT_COMMIT_REF: ATENEA_STAGING_BRANCH,
  ATENEA_STAGING_DOMAIN_ENABLED: 'true',
  ATENEA_STAGING_DOMAIN: ATENEA_STAGING_HOST,
  ATENEA_STAGING_SESSION_ENABLED: 'true',
  ATENEA_STAGING_IDENTITY_PROVIDER: 'supabase-staging',
  ATENEA_STAGING_ACCESS_ENABLED: 'true',
  ATENEA_STAGING_AUTH_REVIEWED: 'true',
  ATENEA_VOICE_ORIGIN: `https://${ATENEA_STAGING_HOST}`,
  ATENEA_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  ATENEA_SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${'a'.repeat(32)}`,
  ATENEA_PRODUCTION_SUPABASE_REFS: 'zzzzzzzzzzzzzzzzzzzz',
  ATENEA_STAGING_ALLOWED_SUBJECTS: '123e4567-e89b-42d3-a456-426614174000',
};

test('custom host guard is ready only for the exact staging branch and reviewed Supabase config', () => {
  assert.equal(stagingDomainGuardReady(stagingEnv), true);
  assert.equal(stagingDomainGuardReady({ ...stagingEnv, VERCEL_ENV: 'production' }), false);
  assert.equal(stagingDomainGuardReady({ ...stagingEnv, VERCEL_GIT_COMMIT_REF: 'main' }), false);
  assert.equal(stagingDomainGuardReady({ ...stagingEnv, ATENEA_STAGING_DOMAIN: 'miatenea.app' }), false);
  assert.equal(stagingDomainGuardReady({ ...stagingEnv, ATENEA_STAGING_AUTH_REVIEWED: 'false' }), false);
  assert.equal(stagingDomainGuardReady({ ...stagingEnv, ATENEA_SUPABASE_URL: 'https://production.supabase.co' }), false);
  assert.equal(stagingDomainGuardReady({ ...stagingEnv, ATENEA_STAGING_ALLOWED_SUBJECTS: '' }), false);
});

test('only explicit login and identity-exchange routes are public on the staging host', () => {
  assert.equal(isPublicStagingPath('/atenea-acceso'), true);
  assert.equal(isPublicStagingPath('/atenea-acceso/activar'), true);
  assert.equal(isPublicStagingPath('/api/atenea-voz/access'), true);
  assert.equal(isPublicStagingPath('/api/atenea-voz/identity-check'), true);
  assert.equal(isPublicStagingPath('/api/atenea-voz/session'), false);
  assert.equal(isPublicStagingPath('/api/atenea/dropbox/callback'), false);
});

test('staging pages and APIs fail closed without a valid app session; other hostnames are unchanged', () => {
  const decide = (args: Partial<Parameters<typeof stagingDomainDecision>[0]>) => stagingDomainDecision({
    hostname: ATENEA_STAGING_HOST, pathname: '/biblioteca', ready: true, authenticated: false, ...args,
  });
  assert.equal(decide({ ready: false }), 'unavailable');
  assert.equal(decide({}), 'redirect-login');
  assert.equal(decide({ pathname: '/api/atenea/dropbox/start' }), 'unauthorized');
  assert.equal(decide({ authenticated: true }), 'pass');
  assert.equal(decide({ hostname: 'frequency-healer.vercel.app', ready: false }), 'pass');
  assert.equal(decide({ hostname: 'STAGING.MIATENEA.APP.' }), 'redirect-login');
  assert.equal(decide({ pathname: '/atenea-acceso' }), 'pass');
});
