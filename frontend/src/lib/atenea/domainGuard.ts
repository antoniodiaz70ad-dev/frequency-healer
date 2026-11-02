import { stagingAuthConfig } from './stagingConfig';

export const ATENEA_STAGING_HOST = 'staging.miatenea.app';
export const ATENEA_STAGING_BRANCH = 'codex/atenea-staging-domain-guard';

const publicPaths = new Set([
  '/atenea-acceso',
  '/atenea-acceso/activar',
  '/api/atenea-voz/access',
  '/api/atenea-voz/identity-check',
  '/api/atenea-voz/reap',
]);

export type StagingDomainDecision = 'pass' | 'unavailable' | 'unauthorized' | 'redirect-login';

export function isPublicStagingPath(pathname: string) {
  return publicPaths.has(pathname);
}

/** Fail closed on a custom domain unless this exact, reviewed Preview branch is serving it. */
export function stagingDomainGuardReady(env: Record<string, string | undefined>) {
  return env.VERCEL_ENV === 'preview' &&
    env.VERCEL_GIT_COMMIT_REF === ATENEA_STAGING_BRANCH &&
    env.ATENEA_STAGING_DOMAIN_ENABLED === 'true' &&
    env.ATENEA_STAGING_DOMAIN === ATENEA_STAGING_HOST &&
    env.ATENEA_STAGING_SESSION_ENABLED === 'true' &&
    env.ATENEA_STAGING_IDENTITY_PROVIDER === 'supabase-staging' &&
    env.ATENEA_STAGING_ACCESS_ENABLED === 'true' &&
    env.ATENEA_STAGING_AUTH_REVIEWED === 'true' &&
    env.ATENEA_VOICE_ORIGIN === `https://${ATENEA_STAGING_HOST}` &&
    stagingAuthConfig(env) !== null;
}

export function stagingDomainDecision(args: {
  hostname: string;
  pathname: string;
  ready: boolean;
  authenticated: boolean;
}): StagingDomainDecision {
  const host = args.hostname.toLowerCase().replace(/\.$/, '');
  if (host !== ATENEA_STAGING_HOST || isPublicStagingPath(args.pathname)) return 'pass';
  if (!args.ready) return 'unavailable';
  if (args.authenticated) return 'pass';
  return args.pathname.startsWith('/api/') ? 'unauthorized' : 'redirect-login';
}
