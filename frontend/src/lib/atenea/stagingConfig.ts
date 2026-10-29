export interface StagingAuthConfig {
  url: string;
  publishableKey: string;
  origin: string;
  allowedSubjects: string[];
}

const projectRef = /^[a-z0-9]{20}$/;
export const subjectId = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

/** This is a separate, reviewed identity project, never a production fallback. */
function stagingProviderConfig(env: Record<string, string | undefined>, cleanup = false): Omit<StagingAuthConfig, 'allowedSubjects'> | null {
  if (env.ATENEA_STAGING_IDENTITY_PROVIDER !== 'supabase-staging' || !cleanup && (env.ATENEA_STAGING_ACCESS_ENABLED !== 'true' ||
      env.ATENEA_STAGING_AUTH_REVIEWED !== 'true')) return null;
  const local = !env.VERCEL && !env.VERCEL_ENV && env.ATENEA_LOCAL_STAGING === 'true';
  if (env.VERCEL_ENV !== 'preview' && !local) return null;
  try {
    const url = env.ATENEA_SUPABASE_URL ?? '';
    const parsed = new URL(url);
    const ref = parsed.hostname.split('.')[0];
    if (!projectRef.test(ref) || parsed.origin !== url || parsed.hostname !== `${ref}.supabase.co` || parsed.protocol !== 'https:') return null;
    const denied = (env.ATENEA_PRODUCTION_SUPABASE_REFS ?? '').split(',').map(value => value.trim());
    if (!denied.length || denied.some(value => !projectRef.test(value)) || denied.includes(ref)) return null;
    const publishableKey = env.ATENEA_SUPABASE_PUBLISHABLE_KEY ?? '';
    // A service-role/secret/legacy JWT key must never reach this page's client props.
    if (!/^sb_publishable_[A-Za-z0-9_-]{16,256}$/.test(publishableKey)) return null;
    const origin = env.ATENEA_VOICE_ORIGIN ?? '';
    const site = new URL(origin);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(site.hostname);
    if (site.origin !== origin || site.protocol !== 'https:' && !(local && loopback && site.protocol === 'http:')) return null;
    return { url, publishableKey, origin };
  } catch { return null; }
}

export function stagingAuthConfig(env: Record<string, string | undefined>, cleanup = false): StagingAuthConfig | null {
  const provider = stagingProviderConfig(env, cleanup);
  if (!provider) return null;
  const allowedSubjects = (env.ATENEA_STAGING_ALLOWED_SUBJECTS ?? '').split(',').map(value => value.trim());
  if (!allowedSubjects.length || allowedSubjects.length > 5 || allowedSubjects.some(value => !subjectId.test(value))) return null;
  return { ...provider, allowedSubjects: [...new Set(allowedSubjects)] };
}

/** Invitations establish provider credentials only. App access still requires the UUID allowlist. */
export function stagingInvitationConfig(env: Record<string, string | undefined>) {
  return env.ATENEA_STAGING_INVITATION_ENABLED === 'true' ? stagingProviderConfig(env) : null;
}

/** Dedicated Vercel integration credentials; never fall back to a shared/production Redis. */
export function stagingRedisConfig(env: Record<string, string | undefined>) {
  if (env.ATENEA_STAGING_IDENTITY_PROVIDER !== 'supabase-staging' || env.VERCEL_ENV !== 'preview') return null;
  const url = env.ATENEA_KV_REST_API_URL?.trim(), token = env.ATENEA_KV_REST_API_TOKEN?.trim();
  if (!url || !token) return null;
  try {
    const endpoint = new URL(url);
    if (endpoint.protocol !== 'https:' || endpoint.origin !== url || endpoint.username || endpoint.password) return null;
    return { url, token };
  } catch { return null; }
}
