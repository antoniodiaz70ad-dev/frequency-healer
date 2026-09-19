'use client';
import { useState } from 'react';
import type { VoiceSessionRecordV1 } from '@/lib/voice/types';
import { n1Summary } from '@/lib/voice/analytics';
import { goalLabels } from './Fields';
import styles from './voice.module.css';
export function exportJSON(value: unknown, filename = 'frequency-healer-voice.json') {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function VoiceHistory({ records, onDelete, rawExport }: { records: VoiceSessionRecordV1[]; onDelete: (id: string | null) => Promise<void>; rawExport: () => void }) {
  const [pending, setPending] = useState<string | null | undefined>(undefined);
  const groups = n1Summary(records);
  return <section><h2>Historial de voz · {records.length}/100</h2><p className={styles.muted}>Solo en este dispositivo. Los registros de voz son independientes de tu diario.</p>
    <button onClick={() => exportJSON(records)}>Exportar sesiones visibles</button><button onClick={rawExport}>Exportar almacenamiento original</button>
    {records.length > 0 && <button onClick={() => setPending(null)}>Borrar historial de voz</button>}
    {pending !== undefined && <div role="alert"><p>{pending === null ? '¿Borrar todos los registros de voz? El diario y otros datos se conservan.' : '¿Borrar esta sesión de voz?'}</p><button onClick={async () => { await onDelete(pending); setPending(undefined); }}>Confirmar borrado</button><button onClick={() => setPending(undefined)}>Cancelar borrado</button></div>}
    {records.map(r => <details key={r.id} className={styles.panel}><summary>{new Date(r.createdAt).toLocaleString('es-MX')} · {goalLabels[r.intent.goal]} · {r.status === 'completed' ? 'Completa' : r.status === 'stopped' ? 'Detenida' : 'Error'} · {r.markers.length} marcadores</summary>
      <p>{r.intent.intention}</p><p>{r.reflection || 'Sin reflexión'}</p><p>{(r.technical.actualDurationMs / 60000).toFixed(1)} min de escucha · {r.proposal.harmonicConfig.baseHz} Hz de base</p>
      {(['clarity', 'stress', 'focus'] as const).map(k => <p key={k}>{({ clarity: 'Claridad', stress: 'Tensión percibida', focus: 'Enfoque' })[k]}: {r.before?.[k] ?? 'omitido'} → {r.after?.[k] ?? 'omitido'}{r.before?.[k] !== undefined && r.after?.[k] !== undefined ? ` (cambio ${r.after[k]! - r.before[k]!})` : ''}</p>)}
      {r.markers.map(m => <p key={m.id}>{(m.offsetMs / 1000).toFixed(1)} s · {m.note} · tonos {m.harmonicSnapshot.activeHz.map(f => f.toFixed(2)).join(', ')} Hz (coincidencia temporal)</p>)}
      <button onClick={() => setPending(r.id)}>Borrar esta sesión</button>
    </details>)}
    <h3>Resultados N=1</h3><p>Estadística descriptiva personal. Una correlación no demuestra que una frecuencia haya causado el cambio.</p>
    {!groups.length && <p>Se requieren al menos 5 sesiones completas comparables con escalas antes/después para mostrar una señal preliminar.</p>}
    {groups.map(g => <div key={g.key} className={styles.panel}><p>{goalLabels[g.goal as keyof typeof goalLabels]} · {g.ratio} · {g.mode === 'sequence' ? 'Secuencia' : 'Simultáneo'} · {g.baseHz} Hz · {g.minutesBand}</p>{g.metrics.map(m => <p key={m.metric}>{({ clarity: 'Claridad', stress: 'Tensión percibida', focus: 'Enfoque' })[m.metric]}: media del cambio {m.mean.toFixed(1)}, mediana {m.median.toFixed(1)} puntos · n={m.n} · {m.label} · {m.first.slice(0, 10)} a {m.last.slice(0, 10)}.</p>)}</div>)}
  </section>;
}
