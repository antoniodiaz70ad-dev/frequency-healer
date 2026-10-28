import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { stagingInvitationConfig } from '@/lib/atenea/stagingConfig';
import StagingInvitationPanel from '@/components/atenea/StagingInvitationPanel';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Activar cuenta · ATENEA', robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default function Page() {
  const config = stagingInvitationConfig(process.env);
  if (!config) notFound();
  return <StagingInvitationPanel url={config.url} publishableKey={config.publishableKey} />;
}
