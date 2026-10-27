import 'server-only';
import { liveSessionRoute } from '@/lib/atenea/liveService';
import { liveDependencies } from '@/lib/atenea/liveRuntime';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const POST = (request: Request) => liveSessionRoute(request, liveDependencies(), process.env.ATENEA_VOICE_ENABLED === 'true', process.env.ATENEA_VOICE_ORIGIN ?? '');
export const DELETE = POST;
