import 'server-only';
import { Redis } from '@upstash/redis';
import { accessTokenAuthenticator } from './liveAuth';
import { RedisLiveStore } from './liveStore';
import { OpenAILiveProvider } from './liveProvider';
import type { LiveDependencies } from './liveTypes';
import { stagingAuthConfig } from './stagingConfig';
import { stagingSubjectHash, supabaseStagingAuthenticator } from './stagingAuth';
import { cookieLiveAccess, RedisIdentitySessions, type AccessDependencies } from './stagingAccess';

/** Lazy: missing staging settings must never break builds or enable anonymous access. */
function identityBindings() {
  const env = process.env;
  const names = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'ATENEA_VOICE_ORIGIN'] as const;
  if (names.some(name => !env[name]?.trim())) return null;
  try {
    if (new URL(env.UPSTASH_REDIS_REST_URL!).protocol !== 'https:' ||
        new URL(env.ATENEA_VOICE_ORIGIN!).origin !== env.ATENEA_VOICE_ORIGIN ||
        new URL(env.ATENEA_VOICE_ORIGIN!).protocol !== 'https:') return null;
    let verify: (request: Request) => Promise<string | null>;
    if (env.ATENEA_STAGING_IDENTITY_PROVIDER) {
      // Keep cookie lookup/cleanup available after creation gates are turned off.
      // New exchanges still require the full reviewed configuration.
      const cleanup = stagingAuthConfig(env, true);
      if (!cleanup) return null;
      const admission = stagingAuthConfig(env);
      verify = admission ? supabaseStagingAuthenticator(admission) : async () => null;
    } else {
      if (!env.ATENEA_AUTH_ISSUER || !env.ATENEA_AUTH_AUDIENCE) return null;
      const jwks = JSON.parse(env.ATENEA_AUTH_JWKS!);
      if (!Array.isArray(jwks.keys) || !jwks.keys.length || jwks.keys.some((key: { kty?: string; d?: string }) => key.kty !== 'RSA' || key.d)) return null;
      verify = accessTokenAuthenticator(jwks, env.ATENEA_AUTH_ISSUER, env.ATENEA_AUTH_AUDIENCE);
    }
    const redis = new Redis({ url: env.UPSTASH_REDIS_REST_URL!, token: env.UPSTASH_REDIS_REST_TOKEN!, retry: { retries: 0 }, signal: () => AbortSignal.timeout(5000) });
    const profile = env.ATENEA_STAGING_IDENTITY_PROVIDER ? stagingAuthConfig(env, true) : null;
    const permitted = (user: string) => !profile || profile.allowedSubjects.some(subject => stagingSubjectHash(profile, subject) === user);
    return { redis, verify, sessions: new RedisIdentitySessions(redis, verify), permitted,
      origin: env.ATENEA_VOICE_ORIGIN!, store: new RedisLiveStore(redis) };
  } catch { return null; }
}

export function accessDependencies(): AccessDependencies | null {
  const bindings = identityBindings(); if (!bindings) return null;
  return { origin: bindings.origin, enabled: process.env.ATENEA_STAGING_IDENTITY_PROVIDER ? process.env.ATENEA_STAGING_SESSION_ENABLED === 'true' && Boolean(stagingAuthConfig(process.env)) : process.env.ATENEA_STAGING_ENABLED === 'true', sessions: bindings.sessions,
    closeForUser: async user => {
      const active = await bindings.store.active(user);
      if (!active || active.closed) return true;
      if (!active.providerId || !process.env.OPENAI_API_KEY) return false;
      const confirmed = await new OpenAILiveProvider(process.env.OPENAI_API_KEY).close(active.providerId);
      if (confirmed) await bindings.store.finish(user, active.requestId);
      return confirmed;
    },
  };
}

export function liveDependencies(): LiveDependencies | null {
  const bindings = identityBindings(); if (!bindings || !process.env.OPENAI_API_KEY) return null;
  return { origin: bindings.origin,
    enabled: (!process.env.ATENEA_STAGING_IDENTITY_PROVIDER || process.env.ATENEA_STAGING_SESSION_ENABLED === 'true' && Boolean(stagingAuthConfig(process.env))) && process.env.ATENEA_STAGING_ENABLED === 'true' && process.env.ATENEA_LIVE_ENABLED === 'true' && process.env.ATENEA_LIVE_REVIEWED === 'true' && process.env.ATENEA_REAPER_READY === 'true' && (process.env.ATENEA_REAPER_TOKEN?.length ?? 0) >= 32,
    ...cookieLiveAccess(bindings.sessions, bindings.store, bindings.permitted),
    store: bindings.store, provider: new OpenAILiveProvider(process.env.OPENAI_API_KEY),
  };
}
