'use client';
import { useEffect, useState, useRef } from 'react';
import { HarmonicEngine } from '@/lib/harmonic/engine';
import { buildSchedule, RATIOS, type HarmonicConfig } from '@/lib/harmonic/math';
import { getAudioEngine } from '@/lib/audioEngine';
import SessionPlan from './SessionPlan';
import ExperimentSession, { type ExperimentSessionHandle } from '../lab/ExperimentSession';
import HarmonicExplorer from '../lab/HarmonicExplorer';
import ConstellationBuilder from '../lab/ConstellationBuilder';
import { inverseHarmonicConfig } from '@/lib/harmonic/apply';
import { proposeOctaveApply } from '@/lib/harmonic/octaveApply';
import { planConstellationPlayback, type ConstellationPlaybackPlan } from '@/lib/harmonic/constellationPlayback';
import { ConstellationStore, CONSTELLATIONS_KEY } from '@/lib/harmonic/constellationStorage';
import type { HarmonicConstellationV1 } from '@/lib/harmonic/constellations';
import GuidedRecommendation from '../lab/GuidedRecommendation';
import { validateGuidedRecommendation, type GuidedRecommendationV1 } from '@/lib/guided/recommendations';
import PersonalizedAdvisor from '../lab/PersonalizedAdvisor';
import StructureProfile from '../lab/StructureProfile';
import ProtocolDiscovery, { type DiscoveryPlaybackRequest } from '../lab/ProtocolDiscovery';
import styles from './voice.module.css';
import { FHPageHeader, FHPageShell } from '../ui/FHLayout';
import HarmonicStructure from '../lab/HarmonicStructure';
import { playbackWakeLockMessage, usePlaybackWakeLock } from '@/lib/playbackLifecycle';
const initial: HarmonicConfig = { baseHz: 220, ratioId: 'fifth', increments: 3, direction: 'ascending', mode: 'sequence', durationSeconds: 300, uiVolume: 20, waveform: 'sine' };
export default function HarmonicLab() {
  const previewRun = useRef(0);
  const [constellationPlan, setConstellationPlan] = useState<ConstellationPlaybackPlan | null>(null);
  const [previewError, setPreviewError] = useState('');
  const startRun = useRef(0); const startPending = useRef(false);
  const currentConfig = useRef(initial);
  const discovery = useRef<DiscoveryPlaybackRequest | null>(null);
  const experiment = useRef<ExperimentSessionHandle>(null);
  const activeExperiment = useRef<{ handle: ExperimentSessionHandle; id: string } | null>(null);
  const [engine] = useState(() => new HarmonicEngine());
  const [config, setConfig] = useState(initial); const [confirmed, setConfirmed] = useState(false);
  const [playing, setPlaying] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const wakeLockMessage = playbackWakeLockMessage(usePlaybackWakeLock(playing));
  let schedule; let invalid = '';
  try { schedule = buildSchedule(config); } catch (e) { invalid = (e as Error).message; }
  useEffect(() => {
    const invalidate = () => { ++previewRun.current; ++startRun.current; startPending.current = false; };
    const stop = () => { invalidate(); engine.stop(); discovery.current?.finished('interrupted'); discovery.current = null; activeExperiment.current?.handle.finish(activeExperiment.current.id, 'interrupted'); activeExperiment.current = null; setPlaying(false); setBusy(false); };
    window.addEventListener('pagehide', stop);
    return () => { invalidate(); engine.dispose(); discovery.current?.finished('interrupted', false); discovery.current = null; activeExperiment.current?.handle.finish(activeExperiment.current.id, 'interrupted', false); activeExperiment.current = null; window.removeEventListener('pagehide', stop); };
  }, [engine]);
  const edit = (change: Partial<HarmonicConfig>) => { const next = { ...currentConfig.current, ...change }; currentConfig.current = next; setConfig(next); setConfirmed(false); ++previewRun.current; setConstellationPlan(null); setPreviewError(''); };
  const startPlayback = async (plan?: ConstellationPlaybackPlan, guided?: GuidedRecommendationV1, consent = false) => {
        if (playing || startPending.current) return;
        ++previewRun.current;
        startPending.current = true; const run = ++startRun.current; setBusy(true); setError('');
        try {
          let playbackConfig = guided ? validateGuidedRecommendation(guided, consent) : config;
          let sourcePayload: string | null = null;
          let linkedConstellation: HarmonicConstellationV1 | undefined;
          if (plan) {
            sourcePayload = localStorage.getItem(CONSTELLATIONS_KEY);
            const stored = (await new ConstellationStore(localStorage).load()).find(row => row.id === plan.constellation.id);
            if (!stored || JSON.stringify(stored) !== JSON.stringify(plan.constellation)) throw new Error('El registro guardado cambió o no está disponible. Prepara otra vista previa.');
            const checked = await planConstellationPlayback(stored, plan.config);
            if (JSON.stringify(checked) !== JSON.stringify(plan)) throw new Error('La propuesta cambió. Confirma una nueva vista previa.');
            playbackConfig = checked.config; linkedConstellation = checked.constellation;
          }
          if (run !== startRun.current) return;
          const handle = experiment.current;
          const id = linkedConstellation ? await handle?.prepareLinked(playbackConfig, linkedConstellation) ?? null : handle?.prepare(playbackConfig) ?? null;
          if (run !== startRun.current) return;
          activeExperiment.current = handle && id ? { handle, id } : null;
          if (plan && localStorage.getItem(CONSTELLATIONS_KEY) !== sourcePayload) throw new Error('La fuente cambió durante la confirmación. Prepara una nueva vista previa.');
          getAudioEngine().stopProtocol();
          const started = await engine.start(playbackConfig, () => {
            if (run !== startRun.current) return;
            activeExperiment.current?.handle.finish(activeExperiment.current.id, 'completed'); activeExperiment.current = null;
            setPlaying(false);
          });
          if (started && run === startRun.current) { activeExperiment.current?.handle.started(activeExperiment.current.id); setPlaying(true); }
        } catch (e) {
          if (run === startRun.current) { activeExperiment.current?.handle.finish(activeExperiment.current.id, 'interrupted'); activeExperiment.current = null; setError((e as Error).message); }
        } finally { if (run === startRun.current) { startPending.current = false; setBusy(false); } }
  };
  const stopPlayback = () => { ++startRun.current; startPending.current = false; engine.stop(); discovery.current?.finished('cancelled'); discovery.current = null; activeExperiment.current?.handle.finish(activeExperiment.current.id, 'cancelled'); activeExperiment.current = null; setPlaying(false); setBusy(false); };
  const startDiscovery = async (request: DiscoveryPlaybackRequest) => {
    if (playing || startPending.current) return;
    ++previewRun.current; startPending.current = true; const run = ++startRun.current;
    discovery.current = request; setBusy(true); setError('');
    try {
      const exact = await request.prepare();
      if (run !== startRun.current) { request.finished('interrupted'); return; }
      getAudioEngine().stopProtocol();
      const started = await engine.start(exact, () => {
        if (run !== startRun.current) return;
        request.finished('completed'); discovery.current = null; setPlaying(false);
      });
      if (started && run === startRun.current) { request.started(); setPlaying(true); }
      else { request.finished('interrupted'); if (discovery.current === request) discovery.current = null; }
    } catch (e) {
      request.finished('interrupted'); if (discovery.current === request) discovery.current = null;
      if (run === startRun.current) setError((e as Error).message);
    } finally { if (run === startRun.current) { startPending.current = false; setBusy(false); } }
  };
  const previewPlayback = async (record: HarmonicConstellationV1) => {
    if (startPending.current || engine.isPlaying()) return;
    const run = ++previewRun.current, expected = currentConfig.current;
    setConstellationPlan(null); setPreviewError('');
    try {
      const stored = (await new ConstellationStore(localStorage).load()).find(row => row.id === record.id);
      if (!stored || JSON.stringify(stored) !== JSON.stringify(record)) throw new Error('El registro guardado cambió. Recarga el historial.');
      const plan = await planConstellationPlayback(stored, expected);
      if (run === previewRun.current && expected === currentConfig.current && !startPending.current && !engine.isPlaying()) setConstellationPlan(plan);
    } catch (e) { if (run === previewRun.current) setPreviewError((e as Error).message); }
  };
  return <FHPageShell width="wide"><div className={`${styles.workspace} ${styles.lab}`}><FHPageHeader eyebrow="Relaciones exactas · motor aislado" title="Laboratorio Armónico" description="Construye, escucha y comprende una estructura acústica. Las relaciones matemáticas no demuestran efectos médicos." /><p className={styles.labRegionLabel}>Build · Construir</p><GuidedRecommendation active={playing || busy} onConfirm={(value, consent) => startPlayback(undefined, value, consent)} onStop={stopPlayback}/><section><h2>Diseño manual</h2><fieldset disabled={playing || busy}><div className={styles.grid}>
    <label>Base (Hz)<input type="number" min={40} max={2000} step="any" value={config.baseHz} onChange={e => edit({ baseHz: Number(e.target.value) })} /></label>
    <label>Relación<select value={config.ratioId} onChange={e => edit({ ratioId: e.target.value as HarmonicConfig['ratioId'] })}>{Object.entries(RATIOS).map(([id, r]) => <option value={id} key={id}>{r.label} ({r.p}:{r.q})</option>)}</select></label>
    <label>Modo<select value={config.mode} onChange={e => edit({ mode: e.target.value as HarmonicConfig['mode'] })}><option value="sequence">Secuencia</option><option value="simultaneous">Simultáneo</option></select></label>
    <label>Duración (minutos)<input type="number" min={1} max={60} value={config.durationSeconds / 60} onChange={e => edit({ durationSeconds: Number(e.target.value) * 60 })} /></label>
    <label>Volumen (0–100)<input type="number" min={0} max={100} value={config.uiVolume} onChange={e => edit({ uiVolume: Number(e.target.value) })} /></label>
    {config.ratioId === 'cascade-13-12' && <><label>Incrementos<input type="number" min={1} max={8} value={config.increments} onChange={e => edit({ increments: Number(e.target.value) })} /></label><label>Trayectoria<select value={config.direction} onChange={e => edit({ direction: e.target.value as HarmonicConfig['direction'] })}><option value="ascending">Ascendente</option><option value="descending">Descendente</option><option value="return">Expansión y retorno</option></select></label></>}
  </div></fieldset></section>
    <HarmonicExplorer config={config} playbackActive={playing || busy} onApply={async (constellation, expectedConfig) => {
      const run = startRun.current;
      const changed = () => currentConfig.current !== expectedConfig || startPending.current || engine.isPlaying() || run !== startRun.current;
      if (changed()) return 'La configuración o reproducción cambió. Selecciona de nuevo con el audio detenido.';
      const result = await inverseHarmonicConfig(constellation, expectedConfig);
      if (changed()) return 'La configuración o reproducción cambió durante la validación. No se aplicó la propuesta.';
      if (result.status !== 'supported') return result.reason;
      edit(result.config);
      return null;
    }} onApplyOctave={(offset, expectedConfig) => {
      if (currentConfig.current !== expectedConfig || startPending.current || engine.isPlaying()) return 'La configuración o reproducción cambió. Selecciona de nuevo con el audio detenido.';
      const result = proposeOctaveApply(offset, expectedConfig);
      if (result.status !== 'supported') return result.reason;
      edit({ baseHz: result.config.baseHz });
      return null;
    }} />
    <ConstellationBuilder context={config} playbackActive={playing || busy} onPreviewPlayback={record => void previewPlayback(record)} />
    <p className={styles.labRegionLabel}>Listen · Escuchar</p>
    {schedule && <HarmonicStructure config={config} schedule={schedule} />}
    {previewError && <p role="alert">{previewError}</p>}
    {constellationPlan && <section aria-label="Confirmación de constelación guardada"><h2>Reproducción de constelación guardada</h2>
      <pre>{constellationPlan.constellation.name || constellationPlan.constellation.id}{'\n'}{constellationPlan.constellation.signature}</pre>
      <p>Vista previa sin audio. Se conservan todos los miembros y su orden; duración y volumen proceden de los controles actuales. Cambiarlos invalida esta propuesta.</p>
      <ol className={styles.steps}>{constellationPlan.constellation.members.map(member => <li key={member.id}>{member.id} · {member.relationshipType} · {member.relationshipType === 'ratio' ? `${member.ratio.numerator}:${member.ratio.denominator}` : '1:1'} · {member.frequencyHz} Hz</li>)}</ol>
      <SessionPlan config={constellationPlan.config} schedule={constellationPlan.schedule} />
      <StructureProfile config={constellationPlan.config} constellation={constellationPlan.constellation}/>
      <p>El registro experimental opcional V2 conserva la identidad y definición completas de esta constelación, además de la configuración exacta enviada al motor. No conduzcas ni manejes maquinaria.</p>
      <button className={styles.primary} disabled={playing || busy} onClick={() => void startPlayback(constellationPlan)}>Confirmar y reproducir constelación</button>
      <button disabled={playing || busy} onClick={() => { ++previewRun.current; setConstellationPlan(null); }}>Cerrar vista previa de reproducción</button>
    </section>}
    <p className={styles.labRegionLabel}>Understand · Comprender</p>
    <StructureProfile config={config} label="Complejidad estructural · avanzado"/>
    <PersonalizedAdvisor active={playing || busy} onConfirm={startDiscovery} onStop={stopPlayback}/>
    <ProtocolDiscovery active={playing || busy} onConfirm={startDiscovery} onStop={stopPlayback}/>
    <ExperimentSession ref={experiment} playbackActive={playing || busy} />
    {(invalid || error) && <p role="alert" className={styles.error}>{invalid || error}</p>}
    {schedule && <section><h2>Propuesta visible</h2><SessionPlan config={config} schedule={schedule} /><p>Comienza con volumen cómodo. No conduzcas ni manejes maquinaria. Mantén la pantalla abierta si tu navegador suspende audio al bloquear el equipo.</p>
      {config.ratioId === 'cascade-13-12' && <label className={styles.check}><input type="checkbox" disabled={playing || busy} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Acepto la exploración experimental 13/12, sin promesas de resultados.</label>}
      <button className={styles.primary} disabled={playing || busy || (config.ratioId === 'cascade-13-12' && !confirmed)} onClick={async () => {
        await startPlayback();
      }}>Confirmar e iniciar</button>

    </section>}
      {(playing || busy) && <button className={styles.stop} onClick={stopPlayback}>Detener sesión</button>}
      <p role="status">{playing ? 'Audio en curso' : busy ? 'Preparando audio…' : 'Audio detenido'}</p>{wakeLockMessage && <p className={styles.muted}>{wakeLockMessage}</p>}
  </div></FHPageShell>;
}
