'use client';
import { useRef, useState } from 'react';
import { currentDailyAction } from '@/lib/voice/dailyPractice';
import { VoiceStore } from '@/lib/voice/storage';
import type { DailyActionV1, VoiceSessionRecordV1 } from '@/lib/voice/types';
import { FHSurface } from '../ui/FHLayout';

export default function DailyActionCard({ record, onSaved, onReload }: {
  record: VoiceSessionRecordV1;
  onSaved: (records: VoiceSessionRecordV1[]) => void;
  onReload: () => void;
}) {
  const [editing, setEditing] = useState<{ text: string; expected: DailyActionV1 } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const action = record.dailyAction;
  if (!action) return null;
  const current = currentDailyAction(action);
  const update = async (status: 'pending' | 'done', text = current.text, expected = action) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      onSaved(await new VoiceStore(localStorage).updateDailyAction(record.id, expected, { text, status }));
      setEditing(null);
    } catch (e) { setError((e as Error).message); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <FHSurface variant="subtle" className="p-5">
    <p className="fh-label">Tu acción cotidiana más reciente</p>
    <h3 className="mt-3 text-lg font-medium text-[var(--fh-text)] [overflow-wrap:anywhere]">{current.text}</h3>
    <p className="mt-2 text-sm text-[var(--fh-text-muted)]">Elegida el <time dateTime={action.revisions[0].changedAt}>{new Date(action.revisions[0].changedAt).toLocaleDateString('es-MX')}</time>. Solo en este navegador y dispositivo.</p>
    <p role="status" className="mt-3 text-sm">Estado: <strong>{current.status === 'done' ? 'Hecha' : 'Pendiente'}</strong></p>
    {editing ? <form className="mt-4 grid gap-3" onSubmit={e => { e.preventDefault(); void update('pending', editing.text, editing.expected); }}>
      <label className="grid gap-2" htmlFor="daily-action-edit">Cambiar mi acción<textarea autoFocus id="daily-action-edit" maxLength={280} required value={editing.text} onChange={e => setEditing({ ...editing, text: e.target.value })} className="min-h-24 rounded-xl border border-[var(--fh-border)] bg-[var(--fh-bg)] p-3 text-[var(--fh-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fh-accent)]" /></label>
      <p className="text-sm text-[var(--fh-text-muted)]">Al confirmar quedará pendiente. La acción original permanece en el historial.</p>
      <div className="flex flex-wrap gap-3"><button className="fh-action fh-action--primary" disabled={busy || !editing.text.trim()}>Guardar cambio</button><button className="fh-action fh-action--secondary" type="button" disabled={busy} onClick={() => setEditing(null)}>Cancelar cambio</button></div>
    </form> : <div className="mt-4 flex flex-wrap gap-3">
      <button className="fh-action fh-action--primary" disabled={busy || current.status === 'done'} onClick={() => void update('done')}>La hice</button>
      <button className="fh-action fh-action--secondary" disabled={busy || current.status === 'pending'} onClick={() => void update('pending')}>Sigue pendiente</button>
      <button className="fh-action fh-action--secondary" disabled={busy} onClick={() => setEditing({ text: current.text, expected: action })}>Quiero cambiarla</button>
    </div>}
    {error && <div className="mt-3"><p role="alert">{error}</p><button className="fh-action fh-action--secondary mt-2" disabled={busy} onClick={() => { setEditing(null); setError(''); onReload(); }}>Descartar edición y recargar acción</button></div>}
  </FHSurface>;
}
