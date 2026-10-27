import { notFound } from 'next/navigation';
import { stagingAuthConfig } from '@/lib/atenea/stagingConfig';
import StagingAccessPanel from '@/components/atenea/StagingAccessPanel';

export const dynamic = 'force-dynamic';
export default function Page() {
  const config = stagingAuthConfig(process.env);
  if (!config) notFound();
  return <StagingAccessPanel url={config.url} publishableKey={config.publishableKey} />;
}
