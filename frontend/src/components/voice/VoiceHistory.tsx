'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { VoiceSessionRecordV1 } from '@/lib/voice/types';
import { n1Summary } from '@/lib/voice/analytics';
import { FHEvidenceBadge, FHStateBadge } from '@/components/ui/FHBadges';
import FHDisclosure from '@/components/ui/FHDisclosure';
import { FHEmptyState } from '@/components/ui/FHLayout';
import { goalLabels } from './Fields';
import styles from './voice.module.css';

export function exportJSON(value: unknown, filename = 'frequency-healer-voice.json') {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const statusLabel = (status: VoiceSessionRecordV1['status']) => status === 'completed' ? 'COMPLETA' : status === 'stopped' ? 'DETENIDA' : 'ERROR';
const metricLabel = { clarity: 'Claridad', stress: 'Tensión percibida', focus: 'Enfoque' } as const;

export default function VoiceHistory({ records, onDelete, rawExport }: { records: VoiceSessionRecordV1[]; onDelete: (id: string | null) => Promise<void>; rawExport: () => void }) {
  const [pending, setPending] = useState<string | null | undefined>(undefined);
  const groups = n1Summary(records);
  return <section className={styles.history}><div className={styles.historyHeader}><div><p className="fh-label">REGISTRO PERSONAL</p><h2>Historial de sesiones · {records.length}/100</h2><p className={styles.muted}>Solo en este dispositivo. Los registros de sesiones son independientes del Diario OBE.</p></div><div className={styles.historyActions}><button onClick={() => exportJSON(records)}>Exportar sesiones visibles</button><button onClick={rawExport}>Exportar almacenamiento original</button>{records.length > 0 && <button onClick={() => setPending(null)}>Borrar historial</button>}</div></div>
    {pending !== undefined && <div role="alert"><p>{pending === null ? '¿Borrar todos los registros de voz? El diario y otros datos se conservan.' : '¿Borrar esta sesión de voz?'}</p><button onClick={async () => { await onDelete(pending); setPending(undefined); }}>Confirmar borrado</button><button onClick={() => setPending(undefined)}>Cancelar borrado</button></div>}
    {!records.length && <FHEmptyState><h3>Todavía no hay sesiones guardadas</h3><p>Cuando completes una sesión y la guardes, aparecerá aquí.</p><Link className="fh-action fh-action--primary" href="/voz">Comenzar sesión guiada</Link></FHEmptyState>}
    <div className={styles.historyList}>{records.map(r => <article key={r.id} className={styles.historyRecord}>
      <header><div><time dateTime={r.createdAt}>{new Date(r.createdAt).toLocaleString('es-MX')}</time><h3>{goalLabels[r.intent.goal]}</h3></div><FHStateBadge state={r.status}>{statusLabel(r.status)}</FHStateBadge></header>
      <p>{r.intent.intention}</p>
      <div className={styles.historyMetrics}>{(['clarity', 'stress', 'focus'] as const).map(k => <div key={k}><span>{metricLabel[k]}</span><strong>{r.before?.[k] ?? 'No registrado'} → {r.after?.[k] ?? 'No registrado'}</strong>{r.before?.[k] !== undefined && r.after?.[k] !== undefined && <small>Cambio {r.after[k]! - r.before[k]!}</small>}</div>)}</div>
      <p className={styles.muted}>{r.reflection || 'Sin reflexión registrada.'}</p>
      <FHDisclosure summary="Configuración y auditoría"><p>ID: <code>{r.id}</code></p><p>Sesión guiada · {(r.technical.actualDurationMs / 60000).toFixed(1)} min de escucha · {r.proposal.harmonicConfig.baseHz} Hz de base</p>{r.markers.map(m => <p key={m.id}>{(m.offsetMs / 1000).toFixed(1)} s · {m.note} · tonos {m.harmonicSnapshot.activeHz.map(f => f.toFixed(2)).join(', ')} Hz (coincidencia temporal)</p>)}</FHDisclosure>
      <button onClick={() => setPending(r.id)}>Borrar esta sesión</button>
    </article>)}</div>
    <div className={styles.n1Header}><h3>Resultados N=1</h3><FHEvidenceBadge category="PERSONAL_N1">EVIDENCIA PERSONAL N=1</FHEvidenceBadge></div><p>Estadística descriptiva personal. Una correlación no demuestra que una frecuencia haya causado el cambio.</p>
    {!groups.length && <p className={styles.muted}>Se requieren al menos 5 sesiones completas comparables con escalas antes/después para mostrar una señal preliminar.</p>}
    {groups.map(g => <div key={g.key} className={styles.panel}><p>{goalLabels[g.goal as keyof typeof goalLabels]} · {g.ratio} · {g.mode === 'sequence' ? 'Secuencia' : 'Simultáneo'} · {g.baseHz} Hz · {g.minutesBand}</p>{g.metrics.map(m => <p key={m.metric}>{metricLabel[m.metric]}: media del cambio {m.mean.toFixed(1)}, mediana {m.median.toFixed(1)} puntos · n={m.n} · {m.label} · {m.first.slice(0, 10)} a {m.last.slice(0, 10)}.</p>)}</div>)}
  </section>;
}
