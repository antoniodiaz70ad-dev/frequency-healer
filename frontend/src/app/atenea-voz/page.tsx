import { notFound } from 'next/navigation';
import AteneaVoiceSession from '@/components/atenea/AteneaVoiceSession';

export const dynamic = 'force-dynamic';
export default function AteneaVoicePage() {
  if (process.env.ATENEA_VOICE_ENABLED !== 'true') notFound();
  return <AteneaVoiceSession />;
}
