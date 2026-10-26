import 'server-only';
import { authorize } from '@/lib/atenea/access';

/** Fail closed, even when a key is present. No credential, SDP or token is returned.
 * Wire audited authentication + persistent quotas + verified provider adapter before enabling. */
export async function POST(request: Request) {
  const status = await authorize(request, process.env.ATENEA_VOICE_ENABLED === 'true', undefined, process.env.ATENEA_VOICE_ORIGIN ?? '');
  return Response.json({ error: status === 404 ? 'not_found' : status === 403 ? 'forbidden' : 'real_provider_not_configured' }, {
    status, headers: { 'Cache-Control': 'no-store' },
  });
}
