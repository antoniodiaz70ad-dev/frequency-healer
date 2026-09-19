import type { HarmonicConfig, HarmonicSchedule } from '@/lib/harmonic/math';
import styles from './voice.module.css';
export default function SessionPlan({ config, schedule }: { config: HarmonicConfig; schedule: HarmonicSchedule }) {
  return <div>
    <p><strong>{config.baseHz} Hz</strong> de base · {config.mode === 'sequence' ? 'Secuencia' : 'Simultáneo'} · {config.durationSeconds / 60} min · volumen {config.uiVolume}/100 · onda sinusoidal</p>
    <p className={styles.muted}>f = base × p/q. Cascada: f(k) = base × (13/12)^k. Solo esta vista redondea a 2 decimales. Ganancia maestra = 0.25 × volumen/100; cada voz simultánea = 1/N.</p>
    <ol className={styles.steps}>{schedule.steps.map((s, i) => <li key={i}><strong>{s.frequencies.map(f => f.toFixed(2)).join(' + ')} Hz</strong> · relación {s.ratios.join(' + ')} · desde {s.offsetSeconds.toFixed(1)} s, durante {s.durationSeconds.toFixed(1)} s</li>)}</ol>
  </div>;
}
