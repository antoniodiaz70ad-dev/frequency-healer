import 'server-only';
import { liveDependencies } from '@/lib/atenea/liveRuntime';
import { reapLiveSessions } from '@/lib/atenea/liveReaper';

export const runtime = 'nodejs';
export const maxDuration = 30;
// External scheduler must call every minute; no schedule or deployment is created by this PR.
export const POST = (request: Request) => reapLiveSessions(request, liveDependencies(), process.env.ATENEA_REAPER_TOKEN);
// Scheduler compatibility only; token authentication remains mandatory on GET.
export const GET = POST;
