import 'server-only';
import { accessDependencies } from '@/lib/atenea/liveRuntime';
import { accessRoute } from '@/lib/atenea/stagingAccess';
export const runtime = 'nodejs';
export const maxDuration = 30;
const handler = (request: Request) => accessRoute(request, accessDependencies(), process.env.ATENEA_VOICE_ENABLED === 'true' || process.env.ATENEA_STAGING_SESSION_ENABLED === 'true', process.env.ATENEA_VOICE_ORIGIN ?? '');
export const GET = handler;
export const POST = handler;
export const DELETE = handler;
