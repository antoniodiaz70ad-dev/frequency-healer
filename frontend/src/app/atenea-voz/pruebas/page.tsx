import { notFound } from 'next/navigation';
import { liveDependencies } from '@/lib/atenea/liveRuntime';
import AteneaStagingSession from '@/components/atenea/AteneaStagingSession';
export const dynamic = 'force-dynamic';
export default function AteneaStagingPage() {
  if (process.env.ATENEA_VOICE_ENABLED !== 'true' || process.env.ATENEA_STAGING_ENABLED !== 'true') notFound();
  const login = process.env.ATENEA_LOGIN_PATH;
  const loginPath = login && /^\/[A-Za-z0-9/_-]*$/.test(login) && !login.startsWith('//') ? login : null;
  return <AteneaStagingSession available={liveDependencies()?.enabled === true} loginPath={loginPath} />;
}
