'use client';

import { useEffect, useRef, useState } from 'react';
import { FHPageHeader, FHPageShell, FHSurface } from '@/components/ui/FHLayout';
import { FIRE_ENABLED } from '@/lib/fire/feature';
import { completedFirePhases, FireClock, FIRE_PHASES, FIRE_TOTAL_MS, firePhaseAt, fireSchedule, localDay } from '@/lib/fire/protocol';
import { emptyFireData, FIRE_STORAGE_KEY, fireSummary, readFireData, saveFireSession, startFireProgram, type FireData, type FireLatency, type FireMode, type FireSession } from '@/lib/fire/storage';
import styles from './fire.module.css';

const labels = { recovery: 'Facilidad de recuperación', presence: 'Presencia percibida', identification: 'Identificación con el contenido' };
const latencyLabels = { immediate: 'Inmediata', brief: 'Breve', late: 'Tardía', unknown: 'No sé' };
const cancelVoice = (enabled: boolean) => { if (enabled && 'speechSynthesis' in window) window.speechSynthesis.cancel(); };
function download(raw: string) {
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'prueba-de-fuego.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Any mental exercise can supply its name; the attention protocol stays independent. */
export default function FirePractice({ exerciseName = '' }: { exerciseName?: string }) {
  const [data, setData] = useState<FireData>(emptyFireData);
  const [exercise, setExercise] = useState(exerciseName);
  const [mode, setMode] = useState<FireMode>('seated');
  const [voice, setVoice] = useState(false);
  const [consent, setConsent] = useState(false);
  const [safe, setSafe] = useState(false);
  const [offBelt, setOffBelt] = useState(false);
  const [stage, setStage] = useState<'setup' | 'practice' | 'report'>('setup');
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [draft, setDraft] = useState<FireSession | null>(null);
  const [message, setMessage] = useState('');
  const [deleteAsked, setDeleteAsked] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const clock = useRef(new FireClock());
  const session = useRef<FireSession | null>(null);
  const phaseSpoken = useRef(-1);

  useEffect(() => {
    if (!FIRE_ENABLED) return;
    // Hydrate the external store after mount and track changes in other tabs.
    const load = () => {
      try { setData(readFireData(localStorage)); }
      catch { setMessage('No se pudieron leer los datos locales. Se conservaron sin sobrescribir; puedes exportarlos o eliminarlos.'); }
      setLoaded(true);
    };
    const timer = window.setTimeout(load, 0);
    const changed = (event: StorageEvent) => { if (event.key === FIRE_STORAGE_KEY || event.key === null) load(); };
    window.addEventListener('storage', changed);
    return () => { clearTimeout(timer); window.removeEventListener('storage', changed); };
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      const now = performance.now();
      const active = clock.current.elapsed(now);
      setElapsed(active);
      if (active >= FIRE_TOTAL_MS && session.current) {
        clock.current.pause(now);
        const finished = { ...session.current, elapsedMs: active, endedAt: new Date().toISOString(), completedPhases: completedFirePhases(active), status: 'completed' as const };
        session.current = finished;
        setDraft(finished);
        setRunning(false);
        setStage('report');
        cancelVoice(voice);
        if (voice && 'speechSynthesis' in window) {
          const end = new SpeechSynthesisUtterance('Práctica terminada. Si estás en la caminadora, sigue vigilando la banda. Detente de forma segura y sal antes de registrar.');
          end.lang = 'es';
          window.speechSynthesis.speak(end);
        }
      }
    }, 250);
    const hidden = () => {
      if (!document.hidden) return;
      const active = clock.current.pause(performance.now());
      setElapsed(active);
      setRunning(false);
      cancelVoice(voice);
      setMessage('Pausa al ocultar la página. Reanuda cuando puedas hacerlo con seguridad.');
    };
    document.addEventListener('visibilitychange', hidden);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', hidden); };
  }, [running, voice]);

  const phase = firePhaseAt(elapsed);
  useEffect(() => {
    if (!voice || !running || phase < 0 || phaseSpoken.current === phase || !('speechSynthesis' in window)) return;
    phaseSpoken.current = phase;
    const instruction = new SpeechSynthesisUtterance(`${FIRE_PHASES[phase].label}. ${FIRE_PHASES[phase].guide}${mode === 'treadmill' ? ' Mantén los ojos abiertos y vigila la banda. Camina normalmente hacia adelante; la estabilidad tiene prioridad.' : ''}`);
    instruction.lang = 'es';
    window.speechSynthesis.speak(instruction);
  }, [phase, running, voice, mode]);

  useEffect(() => () => { clock.current.pause(performance.now()); if (FIRE_ENABLED) cancelVoice(voice); }, [voice]);

  function start() {
    if (!exercise.trim() || (mode === 'treadmill' && !safe)) return;
    clock.current = new FireClock();
    phaseSpoken.current = -1;
    const now = new Date();
    const day = localDay(now);
    session.current = {
      id: crypto.randomUUID(), startedAt: now.toISOString(), endedAt: now.toISOString(), day,
      exercise: exercise.trim(), mode, elapsedMs: 0, completedPhases: [], status: 'stopped',
      programStart: data.programStart && fireSchedule(data.programStart).includes(day) ? data.programStart : null,
      distractions: null, latency: 'unknown', recovery: null, presence: null, identification: null, note: '',
    };
    setDraft(null);
    setOffBelt(false);
    setElapsed(0);
    setMessage('');
    setStage('practice');
    clock.current.resume(performance.now());
    setRunning(true);
  }

  function pause() {
    setElapsed(clock.current.pause(performance.now()));
    setRunning(false);
    cancelVoice(voice);
  }

  function stop() {
    if (!session.current) return;
    const active = clock.current.pause(performance.now());
    setElapsed(active);
    setRunning(false);
    cancelVoice(voice);
    setDraft({ ...session.current, elapsedMs: active, endedAt: new Date().toISOString(), completedPhases: completedFirePhases(active), status: active >= FIRE_TOTAL_MS ? 'completed' : 'stopped' });
    setStage('report');
  }

  function save() {
    if (!draft) return;
    try {
      setData(saveFireSession(localStorage, draft, consent));
      setDraft(null);
      setStage('setup');
      setMessage('Sesión guardada en este navegador.');
    } catch (error) { setMessage((error as Error).message); }
  }

  function exportData() {
    try { download(localStorage.getItem(FIRE_STORAGE_KEY) ?? JSON.stringify(emptyFireData())); }
    catch { setMessage('El navegador no permite leer o descargar los datos locales.'); }
  }

  const remaining = Math.ceil((FIRE_TOTAL_MS - elapsed) / 1000);
  const programSessions = data.sessions.filter(s => s.programStart === data.programStart && data.programStart !== null);
  const schedule = data.programStart ? fireSchedule(data.programStart) : [];
  const reportAllowed = draft?.mode !== 'treadmill' || offBelt;
  if (!FIRE_ENABLED) return null;

  return <FHPageShell width="narrow">
    <FHPageHeader eyebrow="ATENEA · Práctica experimental" title="Prueba de Fuego" description="Aplica atención y metaconciencia a cualquier ejercicio mental: lectura, cálculo, memoria, visualización o una tarea propia." />
    <div className={styles.module}>
      <FHSurface>
        <p><strong>Observado:</strong> la tarea o estímulo. <strong>Observador:</strong> la sensación de ti y de tu cuerpo. <strong>Metaconciencia:</strong> darte cuenta de dónde está tu atención.</p>
        <p className="mt-3">Inspirada en Gurdjieff y Ouspensky. Es una adaptación contemporánea: no mide un nivel de conciencia ni demuestra afirmaciones metafísicas. No requiere televisión.</p>
      </FHSurface>

      {stage === 'setup' && <FHSurface>
        <h2 className="text-xl mb-4">Prepara tu práctica</h2>
        <div className={styles.fields}>
          <label>Ejercicio mental<input maxLength={200} value={exercise} placeholder="Por ejemplo, leer y comprender un párrafo" onChange={e => setExercise(e.target.value)} /></label>
          <label>Modalidad<select aria-label="Modalidad" value={mode} onChange={e => { setMode(e.target.value as FireMode); setSafe(false); }}><option value="seated">Sentado</option><option value="treadmill">Caminadora</option></select></label>
          <label className={styles.check}><input type="checkbox" checked={voice} onChange={e => { setVoice(e.target.checked); if (e.target.checked && !('speechSynthesis' in window)) setMessage('La voz no está disponible en este navegador. Puedes practicar en silencio.'); }} />Guía de voz opcional, con pausas prolongadas</label>
          <p>Silencio por defecto. No se activa cámara ni micrófono. La voz del navegador puede depender de su proveedor; no lee tus notas ni el nombre del ejercicio.</p>
          {mode === 'treadmill' && <div className={styles.safety}>
            <p>Configura todo antes de subir. Camina normalmente hacia adelante, con ojos abiertos y velocidad segura. Vigila la banda; evita mirar fijamente la pantalla. No hagas tareas que comprometan la marcha. Ante inestabilidad, detén el ejercicio y la caminadora de forma segura. La locomoción tiene prioridad.</p>
            <label className={styles.check}><input type="checkbox" checked={safe} onChange={e => setSafe(e.target.checked)} />He elegido una tarea compatible y puedo iniciar con seguridad.</label>
          </div>}
          <ol>{FIRE_PHASES.map((p, i) => <li key={p.label}>{i + 1}. {p.label} · {i === 0 ? '1 minuto' : '2 minutos'}</li>)}</ol>
          <button className="fh-action fh-action--primary" disabled={!loaded || !exercise.trim() || (mode === 'treadmill' && !safe)} onClick={start}>Comenzar 7 minutos</button>
        </div>
      </FHSurface>}

      {stage === 'practice' && <FHSurface>
        <div className={styles.practice}>
          <h2 aria-live="polite">{phase < 0 ? 'Práctica terminada' : FIRE_PHASES[phase].label}</h2>
          <p className={styles.timer} aria-label="Tiempo restante" role="timer">{String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}</p>
          <p>{phase >= 0 && FIRE_PHASES[phase].guide}</p>
          <p>Ejercicio: {exercise.trim()}</p>
          {mode === 'treadmill' && <p className={styles.safety}>Ojos abiertos, hacia adelante. Vigila la banda. No necesitas tocar ni responder durante la práctica. Usa estos controles solo cuando sea seguro.</p>}
          <p>{running ? 'En curso' : 'En pausa'} · Al ocultar la página, la práctica se pausa.</p>
          <div className={styles.actions}>
            {running ? <button className="fh-action" onClick={pause}>Pausar</button> : <button className="fh-action" onClick={() => { phaseSpoken.current = -1; clock.current.resume(performance.now()); setRunning(true); setMessage(''); }}>Reanudar</button>}
            <button className="fh-action" onClick={stop}>Terminar práctica</button>
          </div>
        </div>
      </FHSurface>}

      {stage === 'report' && draft && <FHSurface>
        <h2 className="text-xl">Registro voluntario</h2>
        <p>{draft.status === 'completed' ? 'Sesión completa' : 'Sesión detenida'} · {Math.round(draft.elapsedMs / 1000)} segundos activos · {draft.completedPhases.length}/4 fases completadas.</p>
        {draft.mode === 'treadmill' && <label className={`${styles.check} ${styles.safety}`}><input type="checkbox" checked={offBelt} onChange={e => setOffBelt(e.target.checked)} />Ya me detuve de forma segura y salí de la caminadora.</label>}
        {reportAllowed && <div className={styles.fields}>
          <p>Todos los valores son autorreportes opcionales. No contamos distracciones automáticamente.</p>
          <label>Distracciones identificadas (autorreporte)<input type="number" min={0} step={1} value={draft.distractions ?? ''} onChange={e => setDraft({ ...draft, distractions: e.target.value === '' ? null : Number(e.target.value) })} /></label>
          <label>Tiempo subjetivo para notar la distracción<select aria-label="Tiempo subjetivo para notar la distracción" value={draft.latency} onChange={e => setDraft({ ...draft, latency: e.target.value as FireLatency })}>{Object.entries(latencyLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          {(Object.keys(labels) as Array<keyof typeof labels>).map(key => <label key={key}>{labels[key]} (0–10)<select aria-label={`${labels[key]} (0–10)`} value={draft[key] ?? ''} onChange={e => setDraft({ ...draft, [key]: e.target.value === '' ? null : Number(e.target.value) })}><option value="">Sin registrar</option>{Array.from({ length: 11 }, (_, n) => <option key={n} value={n}>{n}</option>)}</select></label>)}
          <label>Nota opcional<textarea maxLength={2000} value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} /></label>
        </div>}
        <div className={styles.actions}>
          {reportAllowed && <button className="fh-action fh-action--primary" disabled={!consent} onClick={save}>Guardar sesión</button>}
          <button className="fh-action" onClick={() => { cancelVoice(voice); setDraft(null); setStage('setup'); setMessage('Sesión descartada sin guardar.'); }}>Descartar sin guardar</button>
        </div>
      </FHSurface>}

      {stage !== 'practice' && <FHSurface>
        <h2 className="text-xl">Tus datos y programa opcional</h2>
        <label className={styles.check}><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />Autorizo guardar mis registros y programa localmente en este navegador.</label>
        <p>No hay sincronización entre dispositivos. Puedes practicar sin guardar. Si cierras o recargas, la sesión sin guardar se pierde.</p>
        {!data.programStart && <button className="fh-action mt-4" disabled={!consent || stage !== 'setup'} onClick={() => {
          try { setData(startFireProgram(localStorage, localDay(), consent)); setMessage('Programa de 14 días creado.'); }
          catch (error) { setMessage((error as Error).message); }
        }}>Crear programa de 14 días</button>}
        {schedule.length > 0 && <>
          <ol className={styles.calendar}>{schedule.map((day, index) => <li key={day}>Día {index + 1}<br />{day}<br />{programSessions.some(s => s.day === day && s.status === 'completed') ? 'Completado' : programSessions.some(s => s.day === day) ? 'Detenido' : day < localDay() ? 'Sin registro' : 'Pendiente'}</li>)}</ol>
          <h3 className="mt-4">Comparativa descriptiva · autorreportes</h3>
          <p>No establece progreso causal ni validación clínica. Solo sesiones completas; los valores sin registrar se excluyen. Se agrupan ejercicios y modalidades que pueden diferir.</p>
          <div className={styles.comparison}>{[0, 7].map(offset => {
            const rows = programSessions.filter(s => schedule.slice(offset, offset + 7).includes(s.day));
            const count = rows.filter(s => s.status === 'completed').length;
            return <div key={offset}><h4>Días {offset + 1}–{offset + 7}</h4><p>{count} {count === 1 ? 'sesión completa' : 'sesiones completas'}</p>{fireSummary(rows).map(item => <p key={item.key}>{labels[item.key]}: {item.mean === null ? 'Sin datos' : item.mean.toFixed(1)} (n={item.count})</p>)}</div>;
          })}</div>
        </>}
        <h3 className="mt-4">Historial local · {data.sessions.length} {data.sessions.length === 1 ? 'sesión' : 'sesiones'}</h3>
        <ul>{data.sessions.map(s => <li key={s.id}>{s.day} · {s.exercise} · {s.mode === 'seated' ? 'Sentado' : 'Caminadora'} · {s.status === 'completed' ? 'Completa' : 'Detenida'} · {Math.round(s.elapsedMs / 1000)} s</li>)}</ul>
        <div className={styles.actions}>
          <button className="fh-action" onClick={exportData}>Exportar datos de esta práctica</button>
          {!deleteAsked ? <button className="fh-action" onClick={() => setDeleteAsked(true)}>Eliminar datos de esta práctica</button> : <>
            <p>Se borrarán las sesiones y el programa de Prueba de Fuego de este navegador.</p>
            <button className="fh-action" onClick={() => { try { localStorage.removeItem(FIRE_STORAGE_KEY); setData(emptyFireData()); setDeleteAsked(false); setConsent(false); setMessage('Datos de Prueba de Fuego eliminados.'); } catch { setMessage('No se pudieron eliminar los datos.'); } }}>Confirmar eliminación</button>
            <button className="fh-action" onClick={() => setDeleteAsked(false)}>Cancelar eliminación</button>
          </>}
        </div>
      </FHSurface>}
      {message && <p role="status">{message}</p>}
    </div>
  </FHPageShell>;
}
