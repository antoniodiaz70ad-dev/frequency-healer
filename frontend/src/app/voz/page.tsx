import { notFound } from 'next/navigation';
import { VOICE_ENABLED } from '@/lib/voice/feature';
import VoiceJourney from '@/components/voice/VoiceJourney';
export default function VoicePage() {
  if (!VOICE_ENABLED) notFound();
  return <VoiceJourney />;
}
