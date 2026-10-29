import { createHash } from 'node:crypto';
import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from 'jose';

/** Validate an access token from the configured identity provider; never mint identities here.
 * Static public JWKS avoids fetching a URL supplied by a caller. Rotation is a server config update. */
export function accessTokenAuthenticator(jwks: JSONWebKeySet, issuer: string, audience: string) {
  const keys = createLocalJWKSet(jwks);
  return async (request: Request): Promise<string | null> => {
    const authorization = request.headers.get('authorization') ?? '';
    if (!authorization.startsWith('Bearer ') || authorization.length > 8192) return null;
    try {
      const { payload } = await jwtVerify(authorization.slice(7), keys, {
        issuer, audience, algorithms: ['RS256'], requiredClaims: ['sub', 'exp', 'iat'],
        maxTokenAge: '1h', clockTolerance: 5,
      });
      if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 256 ||
          typeof payload.exp !== 'number' || payload.exp > Date.now() / 1000 + 3605 ||
          typeof payload.scope !== 'string' || !payload.scope.split(' ').includes('atenea:voice') ||
          !Array.isArray(payload.permissions) || !payload.permissions.includes('atenea:voice')) return null;
      // Persist only a pseudonymous per-issuer identifier; no email, JWT, transcript or audio.
      return createHash('sha256').update(`${issuer}\0${payload.sub}`).digest('hex');
    } catch { return null; }
  };
}
