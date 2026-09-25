'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { HarmonicConfig } from '@/lib/harmonic/math';
import { STATE_FIELDS, type ExperimentRecordV1, type ExperimentState, type ExperimentStatus } from '@/lib/experiments/types';
import { prepareExperiment, transitionExperiment } from '@/lib/experiments/validation';
import { EXPERIMENTS_KEY, ExperimentStore } from '@/lib/experiments/storage';
import styles from '../voice/voice.module.css';
import SavedExperimentReader from './SavedExperimentReader';
import type { HarmonicConstellationV1 } from '@/lib/harmonic/constellations';
import { prepareExperimentV2, transitionExperimentV2, validateAuditableExperiment, type AuditableExperiment, type ExperimentRecordV2 } from '@/lib/experiments/v2';
import { ExperimentStoreV2, EXPERIMENTS_V2_KEY } from '@/lib/experiments/storageV2';

export interface ExperimentSessionHandle {
  prepare(config: HarmonicConfig): string | null;
  prepareLinked(config: HarmonicConfig, constellation: HarmonicConstellationV1): Promise<string | null>;
  started(id: string | null): void;
  finish(id: string | null, status: 'completed' | 'cancelled' | 'interrupted', notify?: boolean): void;
}
const labels = { clarity: 'Claridad', tension: 'Tensión', focus: 'Enfoque', energy: 'Energía', mood: 'Ánimo' };
const statuses: Record<ExperimentStatus, string> = { prepared: 'Preparado: la reproducción no comenzó', started: 'En curso', completed: 'Completado', cancelled: 'Cancelado por ti', interrupted: 'Interrumpido' };
function download(content: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Ratings({ title, value, onChange }: { title: string; value: ExperimentState; onChange(value: ExperimentState): void }) {
  return <fieldset><legend>{title} · opcional, 0–10</legend><div className={styles.grid}>{STATE_FIELDS.map(field => <label key={field}>{labels[field]}
    <select aria-label={`${title}: ${labels[field]}`} value={value[field] ?? ''} onChange={event => {
      const next = { ...value }; if (event.target.value === '') delete next[field]; else next[field] = Number(event.target.value); onChange(next);
    }}><option value="">Sin registrar</option>{Array.from({ length: 11 }, (_, n) => <option key={n} value={n}>{n}</option>)}</select>
  </label>)}</div></fieldset>;
}

const ExperimentSession = forwardRef<ExperimentSessionHandle, { playbackActive: boolean }>(function ExperimentSession({ playbackActive }, ref) {
  const [enabled, setEnabled] = useState(false);
  const [intention, setIntention] = useState(''), [context, setContext] = useState(''), [expectation, setExpectation] = useState('');
  const [preState, setPreState] = useState<ExperimentState>({}), [postState, setPostState] = useState<ExperimentState>({});
  const [reflection, setReflection] = useState('');
  const [record, setRecord] = useState<AuditableExperiment | null>(null);
  const live = useRef<AuditableExperiment | null>(null), savedRef = useRef(false), mounted = useRef(false), savingRef = useRef(false);
  const [saved, setSaved] = useState(false), [saving, setSaving] = useState(false), [discard, setDiscard] = useState(false);
  const preparingRun = useRef(0), historyRunV2 = useRef(0);
  const [historyV2, setHistoryV2] = useState<ExperimentRecordV2[]>([]), [errorV2, setErrorV2] = useState('');
  const [history, setHistory] = useState<ExperimentRecordV1[]>([]), [error, setError] = useState('');
  useEffect(() => {
    mounted.current = true;
    const refresh = () => { try { setHistory(new ExperimentStore(localStorage).load()); setError(''); } catch (e) { setError((e as Error).message); } };
    const changed = (event: StorageEvent) => { if (event.key === EXPERIMENTS_KEY || event.key === null) refresh(); };
    const leaving = (event: BeforeUnloadEvent) => { if (live.current && !savedRef.current) { event.preventDefault(); event.returnValue = ''; } };
    refresh(); window.addEventListener('storage', changed); window.addEventListener('beforeunload', leaving);
    return () => { mounted.current = false; window.removeEventListener('storage', changed); window.removeEventListener('beforeunload', leaving); };
  }, []);
  useEffect(() => {
    let active = true;
    const refresh = async () => { const run = ++historyRunV2.current; try { const rows = await new ExperimentStoreV2(localStorage).load(); if (active && run === historyRunV2.current) { setHistoryV2(rows); setErrorV2(''); } } catch (e) { if (active && run === historyRunV2.current) { setHistoryV2([]); setErrorV2((e as Error).message); } } };
    void refresh(); const changed = (event: StorageEvent) => { if (event.key === EXPERIMENTS_V2_KEY || event.key === null) void refresh(); };
    window.addEventListener('storage', changed); return () => { active = false; window.removeEventListener('storage', changed); };
  }, []);
  useImperativeHandle(ref, () => ({
    prepare(config) {
      if (!enabled || live.current) return null;
      const draft = prepareExperiment(config, { preState, ...(intention.trim() ? { intention } : {}), ...(context.trim() ? { context } : {}), ...(expectation === '' ? {} : { expectationScore: Number(expectation) }) });
      live.current = draft; savedRef.current = false; setRecord(draft); setSaved(false); setEnabled(false); setDiscard(false);
      return draft.id;
    },
    async prepareLinked(config, constellation) {
      if (!enabled || live.current) return null;
      const run = ++preparingRun.current;
      const draft = await prepareExperimentV2(config, { preState, ...(intention.trim() ? { intention } : {}), ...(context.trim() ? { context } : {}), ...(expectation === '' ? {} : { expectationScore: Number(expectation) }) }, constellation);
      if (!mounted.current || run !== preparingRun.current || live.current) return null;
      live.current = draft; savedRef.current = false; setRecord(draft); setSaved(false); setEnabled(false); setDiscard(false);
      return draft.id;
    },
    started(id) {
      if (!id || live.current?.id !== id) return;
      live.current = live.current.schemaVersion === 2 ? transitionExperimentV2(live.current, 'started') : transitionExperiment(live.current, 'started'); setRecord(live.current);
    },
    finish(id, status, notify = true) {
      if (!id || live.current?.id !== id) return;
      live.current = live.current.schemaVersion === 2 ? transitionExperimentV2(live.current, status) : transitionExperiment(live.current, status);
      if (notify && mounted.current) setRecord(live.current);
    },
  }), [enabled, preState, intention, context, expectation]);
  const editable = record && record.status !== 'started' && !playbackActive && !saved && !saving;
  const finalRecord = () => {
    if (!live.current) throw new Error('No hay un registro para guardar.');
    return validateAuditableExperiment({ ...live.current, postState, ...(reflection.trim() ? { reflection } : {}) });
  };
  const reset = () => {
    ++preparingRun.current; live.current = null; savedRef.current = false; setRecord(null); setSaved(false); setDiscard(false); setEnabled(false);
    setIntention(''); setContext(''); setExpectation(''); setPreState({}); setPostState({}); setReflection('');
  };
  return <section aria-label="Registro opcional de experimentos"><h2>Registrar un experimento · opcional</h2>
    <p>Puedes escuchar sin registrar nada. Los experimentos se guardan solo en este navegador cuando pulsas Guardar.</p>
    <label className={styles.check}><input type="checkbox" checked={enabled} disabled={playbackActive || !!record || saving} onChange={e => setEnabled(e.target.checked)} />Registrar la próxima sesión</label>
    {enabled && <fieldset disabled={playbackActive}>
      <label>Intención (opcional)<textarea maxLength={500} value={intention} onChange={e => setIntention(e.target.value)} /></label>
      <label>Expectativa de una experiencia útil (opcional, 0–10)<select value={expectation} onChange={e => setExpectation(e.target.value)}><option value="">Sin registrar</option>{Array.from({ length: 11 }, (_, n) => <option key={n} value={n}>{n}</option>)}</select></label>
      <label>Contexto (opcional)<textarea maxLength={1000} value={context} onChange={e => setContext(e.target.value)} placeholder="Por ejemplo, momento del día o entorno" /></label>
      <Ratings title="Antes" value={preState} onChange={setPreState} />
      <p>Al pulsar Confirmar e iniciar se fijan estos datos y la configuración mostrada. No se guardan automáticamente.</p>
    </fieldset>}
    {record && <div className={styles.panel}>
      <p role="status">Experimento: {statuses[record.status]} · {saved ? 'Guardado' : 'Sin guardar'}</p>
      <details><summary>Configuración confirmada y datos previos</summary><pre>{JSON.stringify({ schemaVersion: record.schemaVersion, ...(record.schemaVersion === 2 ? { constellation: record.constellation } : {}), configurationSnapshot: record.configurationSnapshot, intention: record.intention, expectationScore: record.expectationScore, context: record.context, preState: record.preState }, null, 2)}</pre></details>
      {!saved && <p>Si sales de esta página, el registro sin guardar se pierde. Ocultar la pestaña interrumpe la reproducción; al volver puedes guardar el resultado.</p>}
      {record.status !== 'started' && <>
        {record.status !== 'prepared' && <fieldset disabled={!editable}><Ratings title="Después" value={postState} onChange={setPostState} /><label>Reflexión (opcional)<textarea maxLength={2000} value={reflection} onChange={e => setReflection(e.target.value)} /></label></fieldset>}
        <button disabled={!editable} onClick={async () => {
          if (savingRef.current) return;
          savingRef.current = true; setSaving(true); setError('');
          try {
            const value = await finalRecord();
            if (value.schemaVersion === 2) { const rows = await new ExperimentStoreV2(localStorage).save(value); ++historyRunV2.current; if (mounted.current) setHistoryV2(rows); }
            else { const rows = await new ExperimentStore(localStorage).save(value); if (mounted.current) setHistory(rows); }
            live.current = value; savedRef.current = true;
            if (mounted.current) { setRecord(value); setSaved(true); }
          } catch (e) { if (mounted.current) setError(`${(e as Error).message} El registro sigue en memoria; puedes exportarlo.`); }
          finally { savingRef.current = false; if (mounted.current) setSaving(false); }
        }}>{saving ? 'Guardando…' : saved ? 'Experimento guardado' : 'Guardar experimento'}</button>
        <button disabled={saving || playbackActive} onClick={async () => { try { download(JSON.stringify(await finalRecord(), null, 2), `experimento-${record.id}.json`); } catch (e) { setError((e as Error).message); } }}>Exportar este experimento</button>
        <button disabled={saving || playbackActive} onClick={() => saved ? reset() : setDiscard(true)}>{saved ? 'Preparar otro experimento' : 'Descartar registro sin guardar'}</button>
        {discard && <div role="alert"><p>¿Descartar este registro sin guardar? Puedes exportarlo antes.</p><button disabled={saving || playbackActive} onClick={reset}>Confirmar descarte</button><button onClick={() => setDiscard(false)}>Conservar registro</button></div>}
        <p>Otra reproducción manual no modifica este registro. Para registrar otra sesión, prepara un nuevo experimento.</p>
      </>}
    </div>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <details><summary>Experimentos guardados ({history.length + historyV2.length})</summary>
      <button onClick={() => { try { download(new ExperimentStore(localStorage).exportJSON(), 'frequency-healer-experiments.json'); } catch (e) { setError((e as Error).message); } }}>Exportar historial de experimentos</button>
      <button onClick={() => { try { download(localStorage.getItem(EXPERIMENTS_KEY) ?? 'null', 'frequency-healer-experiments-original.json'); } catch (e) { setError((e as Error).message); } }}>Exportar almacenamiento original</button>
      {errorV2 && <p role="alert">{errorV2}</p>}
      <button onClick={async () => { try { download(await new ExperimentStoreV2(localStorage).exportJSON(), 'frequency-healer-experiments-v2.json'); } catch (e) { setErrorV2((e as Error).message); } }}>Exportar historial V2 de experimentos</button>
      <button onClick={() => { try { download(localStorage.getItem(EXPERIMENTS_V2_KEY) ?? 'null', 'frequency-healer-experiments-v2-original.json'); } catch (e) { setErrorV2((e as Error).message); } }}>Exportar almacenamiento original V2</button>
      {historyV2.map(row => <SavedExperimentReader key={`v2-${row.id}`} record={row} onExport={() => download(JSON.stringify(row, null, 2), `experimento-v2-${row.id}.json`)} />)}
      {history.map(row => <SavedExperimentReader key={row.id} record={row} onExport={() => download(JSON.stringify(row, null, 2), `experimento-${row.id}.json`)} />)}
    </details>
  </section>;
});
export default ExperimentSession;
