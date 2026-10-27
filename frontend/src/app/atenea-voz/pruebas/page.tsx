import { notFound } from 'next/navigation';
import { stagingAuthConfig } from '@/lib/atenea/stagingConfig';
import { liveDependencies } from '@/lib/atenea/liveRuntime';
import AteneaStagingSession from '@/components/atenea/AteneaStagingSession';
export const dynamic = 'force-dynamic';
export default function AteneaStagingPage() {
  const config = process.env.ATENEA_STAGING_SESSION_ENABLED === 'true' ? stagingAuthConfig(process.env) : null;
  const voiceVisible = process.env.ATENEA_VOICE_ENABLED === 'true' && process.env.ATENEA_STAGING_ENABLED === 'true';
  if (!voiceVisible && !config) notFound();
  const login = process.env.ATENEA_LOGIN_PATH;
  const loginPath = login && /^\/[A-Za-z0-9/_-]*$/.test(login) && !login.startsWith('//') ? login : null;
  return <AteneaStagingSession available={voiceVisible && liveDependencies()?.enabled === true} loginPath={loginPath} identity={config ? { url: config.url, publishableKey: config.publishableKey } : null} />;
}
