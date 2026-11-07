import { notFound } from 'next/navigation';
import { FIRE_ENABLED } from '@/lib/fire/feature';
import FirePractice from '@/components/fire/FirePractice';

export default function FirePage() {
  if (!FIRE_ENABLED) notFound();
  return <FirePractice />;
}
