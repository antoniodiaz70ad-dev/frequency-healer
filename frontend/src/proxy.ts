import { NextResponse, type NextRequest } from 'next/server';
import { accessDependencies } from '@/lib/atenea/liveRuntime';
import { ATENEA_STAGING_HOST, isPublicStagingPath, stagingDomainDecision, stagingDomainGuardReady } from '@/lib/atenea/domainGuard';

const unavailable = () => NextResponse.json({ error: 'staging_access_unavailable' }, {
  status: 503,
  headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
});

export async function proxy(request: NextRequest) {
  const hostname = request.nextUrl.hostname.toLowerCase().replace(/\.$/, '');
  if (hostname !== ATENEA_STAGING_HOST || isPublicStagingPath(request.nextUrl.pathname)) return NextResponse.next();

  const ready = stagingDomainGuardReady(process.env);
  if (!ready) return unavailable();
  const deps = accessDependencies();
  if (!deps?.enabled) return unavailable();

  try {
    const cookie = request.headers.get('cookie');
    const sessionRequest = new Request(request.url, {
      method: 'GET',
      headers: cookie ? { cookie } : {},
    });
    const identity = await deps.sessions.lookup(sessionRequest);
    const decision = stagingDomainDecision({ hostname, pathname: request.nextUrl.pathname, ready, authenticated: Boolean(identity) });
    if (decision === 'pass') {
      const response = NextResponse.next();
      response.headers.set('Cache-Control', 'private, no-store');
      response.headers.set('Vary', 'Cookie');
      return response;
    }
    if (decision === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, {
      status: 401,
      headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    });
    if (decision === 'redirect-login') {
      const response = NextResponse.redirect(new URL('/atenea-acceso', request.url));
      response.headers.set('Cache-Control', 'no-store');
      response.headers.set('X-Robots-Tag', 'noindex, nofollow');
      return response;
    }
    return unavailable();
  } catch {
    return unavailable();
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2)$).*)'],
};
