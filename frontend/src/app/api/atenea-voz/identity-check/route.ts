import 'server-only';
import { stagingAuthConfig } from '@/lib/atenea/stagingConfig';
import { stagingAccessRoute, supabaseStagingAuthenticator } from '@/lib/atenea/stagingAuth';

export const runtime = 'nodejs';
export const maxDuration = 15;
export const POST = (request: Request) => {
  const config = stagingAuthConfig(process.env);
  return stagingAccessRoute(request, process.env.ATENEA_STAGING_ACCESS_ENABLED === 'true', config,
    config ? supabaseStagingAuthenticator(config) : undefined);
};
