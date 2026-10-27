import { readBounded } from '../voice/serverBoundary';
import { LIVE_CONSENT, type LiveDependencies } from './liveTypes';
import type { Mode } from './contracts';

export const liveReply = (status: number, data: object) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export async function liveSessionRoute(request: Request, deps: LiveDependencies | null, flag: boolean, origin: string) {
  // Closing existing sessions remains possible after the emergency creation flag is turned off.
  if (!flag && request.method !== 'DELETE') return liveReply(404, { error: 'not_found' });
  if (!request.headers.get('origin') || request.headers.get('sec-fetch-site') === 'cross-site' ||
      (origin && request.headers.get('origin') !== origin)) return liveReply(403, { error: 'forbidden' });
  if (!origin || !deps || (!deps.enabled && request.method !== 'DELETE')) return liveReply(503, { error: 'real_provider_not_configured' });
  try {
    const user = await deps.authenticate(request);
    if (!user) return liveReply(401, { error: 'unauthorized' });
    if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return liveReply(415, { error: 'json_required' });
    let input;
    try { input = JSON.parse(new TextDecoder().decode(await readBounded(request.body, 65536))); }
    catch { return liveReply(400, { error: 'invalid_input' }); }
    if (!input || typeof input !== 'object' || Array.isArray(input) || typeof input.requestId !== 'string' ||
        !/^[a-f0-9-]{36}$/.test(input.requestId)) return liveReply(400, { error: 'invalid_input' });
    const id: string = input.requestId;
    if (request.method === 'DELETE') {
      if (Object.keys(input).some(key => key !== 'requestId')) return liveReply(400, { error: 'invalid_input' });
      const record = await deps.store.find(user, id);
      if (!record) return liveReply(404, { error: 'not_found' });
      if (record.closed) return liveReply(200, { confirmed: true });
      if (!record.providerId) return liveReply(409, { error: 'creation_unconfirmed', confirmed: false });
      const confirmed = await deps.provider.close(record.providerId);
      if (confirmed) await deps.store.finish(user, id);
      return liveReply(confirmed ? 200 : 202, { confirmed });
    }
    if (Object.keys(input).some(key => !['requestId', 'sdp', 'mode', 'consent'].includes(key)) ||
        input.consent !== LIVE_CONSENT || !['observador', 'decision', 'diario'].includes(input.mode) ||
        typeof input.sdp !== 'string' || !input.sdp.startsWith('v=0') || input.sdp.length > 60000) return liveReply(400, { error: 'invalid_input' });
    if (request.signal.aborted) return liveReply(408, { error: 'cancelled' });
    if (!await deps.store.reserve(user, id, Date.now())) return liveReply(429, { error: 'quota_or_session_limit' });
    if (request.signal.aborted) return liveReply(408, { error: 'cancelled' });
    // The full 600-second reservation is charged even on ambiguous provider failure. No replay/retry.
    let created;
    try { created = await deps.provider.create(input.sdp, input.mode as Mode, user); }
    catch { return liveReply(502, { error: 'creation_unconfirmed' }); }
    try { await deps.store.bind(user, id, created.id); }
    catch { await deps.provider.close(created.id); return liveReply(503, { error: 'storage_unavailable' }); }
    if (request.signal.aborted) {
      if (await deps.provider.close(created.id)) await deps.store.finish(user, id);
      return liveReply(408, { error: 'cancelled' });
    }
    return liveReply(201, { session: { id: created.id }, transport: { type: 'webrtc', sdp: created.sdp }, maxSeconds: 600 });
  } catch { return liveReply(503, { error: 'service_unavailable' }); }
}
