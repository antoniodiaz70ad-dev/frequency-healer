import { notFound } from 'next/navigation';
import { HARMONIC_ENABLED } from '@/lib/voice/feature';
import HarmonicLab from '@/components/voice/HarmonicLab';
export default function HarmonicPage() { if (!HARMONIC_ENABLED) notFound(); return <HarmonicLab />; }
