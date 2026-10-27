import { createHash, timingSafeEqual } from 'node:crypto';
import { liveReply } from './liveService';
import type { LiveDependencies } from './liveTypes';

export async function reapLiveSessions(request: Request, deps: LiveDependencies | null, secret: string | undefined) {
  if (!secret || secret.length < 32 || !deps) return liveReply(503, { error: 'not_configured' });
  const supplied = request.headers.get('authorization') ?? '';
  const digest = (value: string) => createHash('sha256').update(value).digest();
  if (!timingSafeEqual(digest(supplied), digest(`Bearer ${secret}`))) return liveReply(401, { error: 'unauthorized' });
  try {
    const due = await deps.store.due(Date.now()); let confirmed = 0;
    await Promise.allSettled(due.map(async record => {
      if (record.providerId && await deps.provider.close(record.providerId)) { await deps.store.finish(record.user, record.requestId); confirmed++; }
    }));
    return liveReply(200, { processed: due.length, confirmed });
  } catch { return liveReply(503, { error: 'cleanup_unavailable' }); }
}
