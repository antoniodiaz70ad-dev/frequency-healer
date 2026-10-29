import 'server-only';
import { Redis } from '@upstash/redis';
import { accessTokenAuthenticator } from './liveAuth';
import { RedisLiveStore } from './liveStore';
import { OpenAILiveProvider } from './liveProvider';
import type { LiveDependencies } from './liveTypes';
import { RedisIdentitySessions, type AccessDependencies } from './stagingAccess';

/** Lazy: missing staging settings must never break builds or enable anonymous access. */
function identityBindings() {
  const env = process.env;
  const names = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'ATENEA_AUTH_JWKS', 'ATENEA_AUTH_ISSUER', 'ATENEA_AUTH_AUDIENCE', 'ATENEA_VOICE_ORIGIN'] as const;
  if (names.some(name => !env[name]?.trim())) return null;
  try {
    if (new URL(env.UPSTASH_REDIS_REST_URL!).protocol !== 'https:' ||
        new URL(env.ATENEA_VOICE_ORIGIN!).origin !== env.ATENEA_VOICE_ORIGIN ||
        new URL(env.ATENEA_VOICE_ORIGIN!).protocol !== 'https:') return null;
    const jwks = JSON.parse(env.ATENEA_AUTH_JWKS!);
    if (!Array.isArray(jwks.keys) || !jwks.keys.length || jwks.keys.some((key: { kty?: string; d?: string }) => key.kty !== 'RSA' || key.d)) return null;
    const redis = new Redis({ url: env.UPSTASH_REDIS_REST_URL!, token: env.UPSTASH_REDIS_REST_TOKEN!, retry: { retries: 0 }, signal: () => AbortSignal.timeout(5000) });
    const verify = accessTokenAuthenticator(jwks, env.ATENEA_AUTH_ISSUER!, env.ATENEA_AUTH_AUDIENCE!);
    return { redis, verify, sessions: new RedisIdentitySessions(redis, verify), origin: env.ATENEA_VOICE_ORIGIN!, store: new RedisLiveStore(redis) };
  } catch { return null; }
}

export function accessDependencies(): AccessDependencies | null {
  const bindings = identityBindings(); if (!bindings) return null;
  return { origin: bindings.origin, enabled: process.env.ATENEA_STAGING_ENABLED === 'true', sessions: bindings.sessions,
    closeForUser: async (user, sessionId) => {
      const active = await bindings.store.active(user);
      if (!active || active.closed) return true;
      if (active.sessionId !== sessionId) return false;
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
    enabled: process.env.ATENEA_STAGING_ENABLED === 'true' && process.env.ATENEA_LIVE_ENABLED === 'true' && process.env.ATENEA_LIVE_REVIEWED === 'true' && process.env.ATENEA_REAPER_READY === 'true' && (process.env.ATENEA_REAPER_TOKEN?.length ?? 0) >= 32,
    // Voice requires a revocable app-session version. A bearer JWT alone cannot
    // bypass Redis revocation; exchange it at /access before starting voice.
    authenticate: request => bindings.sessions.lookup(request),
    store: bindings.store, provider: new OpenAILiveProvider(process.env.OPENAI_API_KEY),
  };
}
