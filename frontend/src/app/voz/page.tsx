import { createHash } from 'node:crypto';
import { notFound } from 'next/navigation';
import { VOICE_ENABLED } from '@/lib/voice/feature';
import PrivacyGate from '@/components/voice/PrivacyGate';
import VoiceJourney from '@/components/voice/VoiceJourney';
export default function VoicePage() {
  if (!VOICE_ENABLED) notFound();
  const transcriptionEnabled = Boolean(process.env.VOICE_TRANSCRIPTION_URL && process.env.VOICE_TRANSCRIPTION_TOKEN);
  const aiEnabled = process.env.VOICE_AI_ENABLED === 'true' && Boolean(process.env.VOICE_INTENT_URL && process.env.VOICE_INTENT_TOKEN);
  const processingVersion = createHash('sha256').update([process.env.VOICE_PROCESSING_VERSION ?? 'v1', process.env.VOICE_TRANSCRIPTION_URL ?? '', process.env.VOICE_INTENT_URL ?? ''].join('|')).digest('hex').slice(0, 16);
  const buildCommit = (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7);
  return <PrivacyGate processingVersion={processingVersion} transcriptionEnabled={transcriptionEnabled} aiEnabled={aiEnabled}><VoiceJourney transcriptionEnabled={transcriptionEnabled} aiEnabled={aiEnabled} buildCommit={buildCommit} /></PrivacyGate>;
}
