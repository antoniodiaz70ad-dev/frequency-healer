import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { decodeJwt } from 'jose';
import { subjectId, type StagingAuthConfig } from './stagingConfig';
import { readBounded } from '../voice/serverBoundary';

interface VerifiedUser { id: string; is_anonymous?: boolean; email_confirmed_at?: string }
export type LookupUser = (jwt: string) => Promise<VerifiedUser | null>;

export const stagingSubjectHash = (config: StagingAuthConfig, subject: string) =>
  createHash('sha256').update(`${config.url}/auth/v1\0${subject}`).digest('hex');

/** Decoding only rejects unsuitable claims. Auth.getUser performs remote authentication. */
export function stagingAuthenticator(config: StagingAuthConfig, lookup: LookupUser) {
  return async (request: Request): Promise<string | null> => {
    const bearer = request.headers.get('authorization') ?? '';
    if (!bearer.startsWith('Bearer ') || bearer.length > 8192) return null;
    try {
      const token = bearer.slice(7), claims = decodeJwt(token), now = Date.now() / 1000;
      if (claims.iss !== `${config.url}/auth/v1` || claims.aud !== 'authenticated' || claims.role !== 'authenticated' ||
          typeof claims.sub !== 'string' || !config.allowedSubjects.includes(claims.sub) ||
          typeof claims.session_id !== 'string' || !subjectId.test(claims.session_id) ||
          typeof claims.iat !== 'number' || !Number.isFinite(claims.iat) || claims.iat > now + 5 || now - claims.iat > 3600 ||
          typeof claims.exp !== 'number' || !Number.isFinite(claims.exp) || claims.exp <= now || claims.exp - claims.iat > 3600 ||
          claims.is_anonymous === true) return null;
      const user = await lookup(token);
      if (!user || user.id !== claims.sub || user.is_anonymous !== false || !user.email_confirmed_at) return null;
      return stagingSubjectHash(config, user.id);
    } catch { return null; }
  };
}

export function supabaseStagingAuthenticator(config: StagingAuthConfig) {
  const client = createClient(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000) }) },
  });
  return stagingAuthenticator(config, async token => {
    const { data, error } = await client.auth.getUser(token);
    return error ? null : data.user;
  });
}

/** Authentication probe only: no audio, quota reservation, model calls or writes. */
export async function stagingAccessRoute(request: Request, enabled: boolean, config: StagingAuthConfig | null,
  authenticate?: (request: Request) => Promise<string | null>) {
  const reply = (status: number, data: object) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!enabled) return reply(404, { error: 'not_found' });
  if (!config || !authenticate) return reply(503, { error: 'staging_not_configured' });
  if (request.headers.get('origin') !== config.origin || request.headers.get('sec-fetch-site') === 'cross-site') return reply(403, { error: 'forbidden' });
  if (request.method !== 'POST') return reply(400, { error: 'invalid_request' });
  // Next may wrap a zero-byte POST in a non-null stream.
  try { if (request.body && (await readBounded(request.body, 1)).length) return reply(400, { error: 'invalid_request' }); }
  catch { return reply(400, { error: 'invalid_request' }); }
  try {
    if (!await authenticate(request)) return reply(401, { error: 'unauthorized' });
    return reply(200, { authorized: true, scope: 'atenea:identity-check', mode: 'authentication-only' });
  } catch { return reply(503, { error: 'authentication_unavailable' }); }
}
