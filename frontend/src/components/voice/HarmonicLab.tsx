'use client';
import { useEffect, useState, useRef } from 'react';
import { HarmonicEngine } from '@/lib/harmonic/engine';
import { buildSchedule, RATIOS, type HarmonicConfig } from '@/lib/harmonic/math';
import { getAudioEngine } from '@/lib/audioEngine';
import SessionPlan from './SessionPlan';
import ExperimentSession, { type ExperimentSessionHandle } from '../lab/ExperimentSession';
import styles from './voice.module.css';
const initial: HarmonicConfig = { baseHz: 220, ratioId: 'fifth', increments: 3, direction: 'ascending', mode: 'sequence', durationSeconds: 300, uiVolume: 20, waveform: 'sine' };
export default function HarmonicLab() {
  const startRun = useRef(0); const startPending = useRef(false);
  const experiment = useRef<ExperimentSessionHandle>(null);
  const activeExperiment = useRef<{ handle: ExperimentSessionHandle; id: string } | null>(null);
  const [engine] = useState(() => new HarmonicEngine());
  const [config, setConfig] = useState(initial); const [confirmed, setConfirmed] = useState(false);
  const [playing, setPlaying] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  let schedule; let invalid = '';
  try { schedule = buildSchedule(config); } catch (e) { invalid = (e as Error).message; }
  useEffect(() => {
    const invalidate = () => { ++startRun.current; startPending.current = false; };
    const stop = () => { invalidate(); engine.stop(); activeExperiment.current?.handle.finish(activeExperiment.current.id, 'interrupted'); activeExperiment.current = null; setPlaying(false); setBusy(false); };
    const hidden = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', stop);
    return () => { invalidate(); engine.dispose(); activeExperiment.current?.handle.finish(activeExperiment.current.id, 'interrupted', false); activeExperiment.current = null; document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', stop); };
  }, [engine]);
  const edit = (change: Partial<HarmonicConfig>) => { setConfig({ ...config, ...change }); setConfirmed(false); };
  return <div className={styles.workspace}><span className={styles.tag}>Relaciones exactas · motor aislado</span><h1>Laboratorio Armónico</h1><p>Configura una exploración sonora. Las relaciones matemáticas no demuestran efectos médicos.</p><section><h2>Diseño manual</h2><fieldset disabled={playing || busy}><div className={styles.grid}>
    <label>Base (Hz)<input type="number" min={40} max={2000} step="any" value={config.baseHz} onChange={e => edit({ baseHz: Number(e.target.value) })} /></label>
    <label>Relación<select value={config.ratioId} onChange={e => edit({ ratioId: e.target.value as HarmonicConfig['ratioId'] })}>{Object.entries(RATIOS).filter(([id]) => id !== 'root').map(([id, r]) => <option value={id} key={id}>{r.label} ({r.p}:{r.q})</option>)}</select></label>
    <label>Modo<select value={config.mode} onChange={e => edit({ mode: e.target.value as HarmonicConfig['mode'] })}><option value="sequence">Secuencia</option><option value="simultaneous">Simultáneo</option></select></label>
    <label>Duración (minutos)<input type="number" min={1} max={60} value={config.durationSeconds / 60} onChange={e => edit({ durationSeconds: Number(e.target.value) * 60 })} /></label>
    <label>Volumen (0–100)<input type="number" min={0} max={100} value={config.uiVolume} onChange={e => edit({ uiVolume: Number(e.target.value) })} /></label>
    {config.ratioId === 'cascade-13-12' && <><label>Incrementos<input type="number" min={1} max={8} value={config.increments} onChange={e => edit({ increments: Number(e.target.value) })} /></label><label>Trayectoria<select value={config.direction} onChange={e => edit({ direction: e.target.value as HarmonicConfig['direction'] })}><option value="ascending">Ascendente</option><option value="descending">Descendente</option><option value="return">Expansión y retorno</option></select></label></>}
  </div></fieldset></section>
    <ExperimentSession ref={experiment} playbackActive={playing || busy} />
    {(invalid || error) && <p role="alert" className={styles.error}>{invalid || error}</p>}
    {schedule && <section><h2>Propuesta visible</h2><SessionPlan config={config} schedule={schedule} /><p>Comienza con volumen cómodo. No conduzcas ni manejes maquinaria. Al ocultar la pestaña, el audio se detiene.</p>
      {config.ratioId === 'cascade-13-12' && <label className={styles.check}><input type="checkbox" disabled={playing || busy} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Acepto la exploración experimental 13/12, sin promesas de resultados.</label>}
      <button className={styles.primary} disabled={playing || busy || (config.ratioId === 'cascade-13-12' && !confirmed)} onClick={async () => {
        if (playing || startPending.current) return;
        startPending.current = true; const run = ++startRun.current; setBusy(true); setError('');
        try {
          const handle = experiment.current, id = handle?.prepare(config) ?? null;
          activeExperiment.current = handle && id ? { handle, id } : null;
          getAudioEngine().stopProtocol();
          const started = await engine.start(config, () => {
            if (run !== startRun.current) return;
            activeExperiment.current?.handle.finish(activeExperiment.current.id, 'completed'); activeExperiment.current = null;
            setPlaying(false);
          });
          if (started && run === startRun.current) { activeExperiment.current?.handle.started(activeExperiment.current.id); setPlaying(true); }
        } catch (e) {
          if (run === startRun.current) { activeExperiment.current?.handle.finish(activeExperiment.current.id, 'interrupted'); activeExperiment.current = null; setError((e as Error).message); }
        } finally { if (run === startRun.current) { startPending.current = false; setBusy(false); } }
      }}>Confirmar e iniciar</button>
      {(playing || busy) && <button className={styles.stop} onClick={() => { ++startRun.current; startPending.current = false; engine.stop(); activeExperiment.current?.handle.finish(activeExperiment.current.id, 'cancelled'); activeExperiment.current = null; setPlaying(false); setBusy(false); }}>Detener sesión</button>}
      <p role="status">{playing ? 'Audio en curso' : busy ? 'Preparando audio…' : 'Audio detenido'}</p>
    </section>}
  </div>;
}
