import 'server-only';
import { Redis } from '@upstash/redis';
import { accessTokenAuthenticator } from './liveAuth';
import { RedisLiveStore } from './liveStore';
import { OpenAILiveProvider } from './liveProvider';
import type { LiveDependencies } from './liveTypes';

/** Lazy: missing staging settings must never break builds or enable anonymous access. */
export function liveDependencies(): LiveDependencies | null {
  const env = process.env;
  const names = ['OPENAI_API_KEY', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'ATENEA_AUTH_JWKS', 'ATENEA_AUTH_ISSUER', 'ATENEA_AUTH_AUDIENCE', 'ATENEA_VOICE_ORIGIN'] as const;
  if (names.some(name => !env[name]?.trim())) return null;
  try {
    if (new URL(env.UPSTASH_REDIS_REST_URL!).protocol !== 'https:' ||
        new URL(env.ATENEA_VOICE_ORIGIN!).origin !== env.ATENEA_VOICE_ORIGIN ||
        new URL(env.ATENEA_VOICE_ORIGIN!).protocol !== 'https:') return null;
    const jwks = JSON.parse(env.ATENEA_AUTH_JWKS!);
    if (!Array.isArray(jwks.keys) || !jwks.keys.length || jwks.keys.some((key: { kty?: string; d?: string }) => key.kty !== 'RSA' || key.d)) return null;
    const redis = new Redis({ url: env.UPSTASH_REDIS_REST_URL!, token: env.UPSTASH_REDIS_REST_TOKEN!, retry: { retries: 0 }, signal: () => AbortSignal.timeout(5000) });
    return { origin: env.ATENEA_VOICE_ORIGIN!,
      enabled: env.ATENEA_LIVE_ENABLED === 'true' && env.ATENEA_LIVE_REVIEWED === 'true' && env.ATENEA_REAPER_READY === 'true',
      authenticate: accessTokenAuthenticator(jwks, env.ATENEA_AUTH_ISSUER!, env.ATENEA_AUTH_AUDIENCE!),
      store: new RedisLiveStore(redis), provider: new OpenAILiveProvider(env.OPENAI_API_KEY!),
    };
  } catch { return null; }
}
