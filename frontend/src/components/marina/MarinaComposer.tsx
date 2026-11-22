'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FHSurface } from '@/components/ui/FHLayout';
import { getAudioEngine } from '@/lib/audioEngine';
import { MarinaComposerAudio } from '@/lib/marina/composerAudio';
import {
  COMPOSER_RECIPES_KEY, COMPOSER_SESSIONS_KEY, COMPOSER_VERSION, NANO_REFERENCES, NANO_SOURCE,
  defaultComposition, starterCompositions, actionPracticeComposition, appendComposerActionFollowUp, layerLabel, readCompositions, readComposerSessions, saveComposition, saveComposerSession,
  validateComposition, type ComposerLayer, type ComposerRecipe, type ComposerSession, type SavedComposition,
} from '@/lib/marina/composer';
import styles from './marina.module.css';
import { useMarinaMediaSession } from './useMarinaMediaSession';
import { emptyPracticeReview, validateActionPlan } from '@/lib/marina/actionPractice';
import { ComposerActionPlanEditor, ComposerActionGuide, ComposerActionReview, ComposerActionDiary } from './ComposerActionPractice';

type Status = 'idle' | 'starting' | 'playing' | 'paused' | 'completed' | 'stopped';
const time = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms % 60000 / 1000)).padStart(2, '0')}`;
function exportJSON(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function MarinaComposer({ onBusy }: { onBusy: (busy: boolean) => void }) {
  const [recipe, setRecipe] = useState<ComposerRecipe>(defaultComposition);
  const [starters] = useState(starterCompositions);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedComposition[]>([]);
  const [sessions, setSessions] = useState<ComposerSession[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [volume, setVolume] = useState(.15);
  const [elapsed, setElapsed] = useState(0);
  const [experience, setExperience] = useState('');
  const [message, setMessage] = useState('');
  const [storageError, setStorageError] = useState(false);
  const [focusBefore, setFocusBefore] = useState<number | null>(null);
  const [practiceReview, setPracticeReview] = useState(emptyPracticeReview);
  const [visualVisible, setVisualVisible] = useState(true);
  const audio = useRef<MarinaComposerAudio | null>(null);
  const operation = useRef(0);
  const elapsedRef = useRef(0);
  const snapshot = useRef<{ id: string; startedAt: string; recipe: ComposerRecipe } | null>(null);
  const volumeRef = useRef(volume);
  const locked = status !== 'idle';
  const active = status === 'playing' || status === 'paused' || status === 'starting';
  const durationMs = recipe.durationMinutes * 60000;
  const invalidate = useCallback(() => { operation.current++; }, []);

  const pause = useCallback(() => {
    operation.current++;
    const value = audio.current?.elapsedMs() ?? elapsedRef.current;
    elapsedRef.current = value; setElapsed(value);
    audio.current?.stop(); setStatus('paused');
  }, []);
  useEffect(() => {
    onBusy(locked);
    return () => onBusy(false);
  }, [locked, onBusy]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      for (const read of [() => setSaved(readCompositions(localStorage)), () => setSessions(readComposerSessions(localStorage))]) {
        try { read(); } catch (error) { setStorageError(true); setMessage((error as Error).message); }
      }
    }, 0);
    return () => { window.clearTimeout(timer); invalidate(); audio.current?.dispose(); };
  }, [invalidate]);
  useEffect(() => { volumeRef.current = volume; audio.current?.setVolume(volume); }, [volume]);
  useEffect(() => {
    if (status !== 'playing') return;
    const timer = window.setInterval(() => {
      const value = Math.min(durationMs, audio.current?.elapsedMs() ?? 0);
      elapsedRef.current = value; setElapsed(value);
      if (value >= durationMs) {
        operation.current++; audio.current?.stop(); setStatus('completed');
        setMessage('La composición terminó. Puedes registrar tu experiencia.');
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [status, durationMs]);

  function updateLayer(id: string, patch: Partial<ComposerLayer>) {
    setRecipe(current => ({ ...current, layers: current.layers.map(layer => layer.id === id ? { ...layer, ...patch } : layer) }));
  }
  async function play(resume = false) {
    const ticket = ++operation.current;
    try {
      if (!resume) {
        validateComposition(recipe);
        if (recipe.actionPlan) validateActionPlan(recipe.actionPlan, true);
        if (!recipe.layers.some(layer => layer.enabled && layer.level > 0)) throw new Error('Activa al menos una capa con volumen mayor que cero.');
        snapshot.current = { id: crypto.randomUUID(), startedAt: new Date().toISOString(), recipe: structuredClone(recipe) };
        elapsedRef.current = 0; setElapsed(0); setExperience(''); setPracticeReview(emptyPracticeReview(focusBefore));
      }
      if (!snapshot.current) return;
      setStatus('starting'); setMessage('');
      audio.current ??= new MarinaComposerAudio(undefined, () => getAudioEngine().stop(), () => {
        pause(); setMessage('El dispositivo interrumpió el audio. Puedes reanudar la composición.');
      });
      const started = await audio.current.play(snapshot.current.recipe, volumeRef.current, elapsedRef.current);
      if (!started || operation.current !== ticket) return;
      setStatus('playing');
    } catch (error) {
      if (ticket === operation.current) {
        audio.current?.stop(); setStatus(snapshot.current ? 'paused' : 'idle'); setMessage((error as Error).message);
      }
    }
  }
  function stop() {
    operation.current++;
    elapsedRef.current = audio.current?.elapsedMs() ?? elapsedRef.current;
    setElapsed(elapsedRef.current); audio.current?.stop(); setStatus('stopped');
    setMessage('Composición detenida. Puedes guardar la experiencia y sus ajustes.');
  }
  function resetSession() {
    snapshot.current = null; elapsedRef.current = 0; setElapsed(0); setStatus('idle'); setExperience(''); setFocusBefore(null); setPracticeReview(emptyPracticeReview());
  }
  function saveRecipe() {
    try {
      const row = { id: selectedId ?? crypto.randomUUID(), savedAt: new Date().toISOString(), recipe: structuredClone(recipe) };
      setSaved(saveComposition(localStorage, row)); setSelectedId(row.id); setMessage('Receta guardada en este navegador.');
    } catch (error) { setMessage((error as Error).message); }
  }
  function saveSession() {
    if (!snapshot.current) return;
    const row: ComposerSession = { ...snapshot.current, endedAt: new Date().toISOString(), elapsedMs: Math.round(Math.min(durationMs, elapsedRef.current)), status: status === 'completed' ? 'completed' : 'stopped', experience,
      ...(snapshot.current.recipe.actionPlan ? { practiceReview: structuredClone(practiceReview) } : {}),
    };
    try {
      setSessions(saveComposerSession(localStorage, row)); resetSession(); setMessage('Experiencia guardada con la composición completa.');
    } catch (error) {
      setMessage(`${(error as Error).message} Descarga esta sesión para conservarla.`);
      exportJSON(row, 'marina-compositor-recuperacion.json');
    }
  }
  const visualRate = recipe.layers.find(layer => layer.enabled && layer.mode === 'pulse' && layer.rateHz <= 1)?.rateHz ?? .1;
  const scale = .93 + .07 * Math.sin(2 * Math.PI * visualRate * elapsed / 1000);
  useMarinaMediaSession(recipe.name, durationMs, elapsed, active, status === 'playing', {
    play: () => { if (status === 'paused') void play(true); },
    pause: () => { if (status === 'playing' || status === 'starting') pause(); },
    stop: () => { if (active) stop(); },
  });

  return <>
    <ComposerActionPlanEditor plan={recipe.actionPlan} disabled={locked} focusBefore={focusBefore} onFocusBefore={setFocusBefore}
      onChange={actionPlan => setRecipe(current => ({ ...current, actionPlan }))}
      onPrepare={() => { setRecipe(actionPracticeComposition()); setSelectedId(null); setFocusBefore(null); setMessage('Práctica de 8 minutos preparada. Completa tu plan y pulsa Escuchar composición cuando estés listo.'); }}
      onListen={() => { void play(); document.getElementById('marina-composer-player')?.scrollIntoView({ block: 'start' }); }}
      onSave={saveRecipe} />
    <FHSurface className="p-5 md:p-7">
      <p className={styles.eyebrow}>Disponibles en todos tus dispositivos</p>
      <h2>Tu secuencia · 24 minutos</h2>
      <p className={styles.muted}>Estas cuatro recetas están incluidas en la aplicación: puedes abrirlas en iPhone, Samsung o computadora. Carga los tramos 01 → 02 → 03 en orden; Exploración 40 queda para otra sesión.</p>
      {starters.map(starter => <article key={starter.name} className={styles.savedComposition}>
        <div><h3>{starter.name}</h3><p className={styles.muted}>{starter.durationMinutes} min · {starter.layers.filter(layer => layer.enabled).length} capas activas</p></div>
        <button type="button" className="fh-action fh-action--secondary" disabled={locked} aria-label={`Usar ${starter.name}`} onClick={() => {
          setRecipe(structuredClone(starter)); setSelectedId(null); setFocusBefore(null); setMessage('Receta incluida cargada. Toca Escuchar composición cuando estés listo.');
        }}>Usar receta</button>
      </article>)}
      <p className={styles.muted}>Si personalizas una receta, guarda tu copia en Mis recetas. Esas copias y tu diario se conservan sólo en este dispositivo; los cambios no se sincronizan entre teléfonos.</p>
      <a href="/marina-punto-cero/compositor">Enlace directo al compositor</a>
    </FHSurface>
    <FHSurface className="p-5 md:p-7">
      <div className={styles.titleRow}><div><p className={styles.eyebrow}>Sonido por capas</p><h2>Tu compositor</h2></div><span className={styles.tag}>Hasta tres capas</span></div>
      <p className={styles.muted}>Combina tonos, pulsaciones y diferencias binaurales. Guarda una receta para volver a explorar sus mismos ajustes.</p>
      <div className={styles.fields}>
        <label>Nombre de la composición<input type="text" maxLength={120} disabled={locked} value={recipe.name} onChange={event => setRecipe(current => ({ ...current, name: event.target.value }))} /></label>
        <label>Duración de la composición (minutos)<input type="number" min="1" max="240" step="1" disabled={locked} value={recipe.durationMinutes} onChange={event => setRecipe(current => ({ ...current, durationMinutes: Number(event.target.value) }))} /></label>
        <label>Transición de entrada y salida (segundos)<input type="number" min="0.05" max="10" step="0.05" disabled={locked} value={recipe.transitionSeconds} onChange={event => setRecipe(current => ({ ...current, transitionSeconds: Number(event.target.value) }))} /></label>
        <label className={styles.check}><input type="checkbox" disabled={locked} checked={recipe.visual} onChange={event => setRecipe(current => ({ ...current, visual: event.target.checked }))} /> Geometría de acompañamiento</label>
      </div>
      <label className={styles.field}>Intención de la composición<textarea disabled={locked} maxLength={6000} value={recipe.intention} onChange={event => setRecipe(current => ({ ...current, intention: event.target.value }))} /></label>
      <div className={styles.composerLayers}>
        {recipe.layers.map((layer, index) => <fieldset key={layer.id} className={styles.composerLayer} disabled={locked}>
          <legend>Capa {index + 1} · {layer.name}</legend>
          <label className={styles.check}><input type="checkbox" checked={layer.enabled} onChange={event => updateLayer(layer.id, { enabled: event.target.checked })} /> Activar capa {index + 1}</label>
          <div className={styles.fields}>
            <label>Tipo de capa {index + 1}<select value={layer.mode} onChange={event => updateLayer(layer.id, { mode: event.target.value as ComposerLayer['mode'] })}><option value="tone">Tono continuo</option><option value="pulse">Pulso sobre portadora</option><option value="binaural">Binaural estéreo</option></select></label>
            <label>Portadora de capa {index + 1} (Hz)<input type="number" min="20" step="any" value={layer.carrierHz} onChange={event => updateLayer(layer.id, { carrierHz: Number(event.target.value) })} /></label>
            {layer.mode !== 'tone' && <label>{layer.mode === 'binaural' ? 'Diferencia' : 'Modulación'} de capa {index + 1} (Hz)<input type="number" min="0.000001" max="40" step="any" value={layer.rateHz} onChange={event => updateLayer(layer.id, { rateHz: Number(event.target.value) })} /></label>}
            {layer.mode === 'pulse' && <label>Profundidad de capa {index + 1} · {Math.round(layer.depth * 100)} %<input type="range" min="0" max="1" step="0.01" value={layer.depth} onChange={event => updateLayer(layer.id, { depth: Number(event.target.value) })} /></label>}
            <label>Nivel de capa {index + 1} · {Math.round(layer.level * 100)} %<input type="range" min="0" max="1" step="0.01" value={layer.level} onChange={event => updateLayer(layer.id, { level: Number(event.target.value) })} /></label>
          </div>
          <p className={styles.muted}>{layerLabel(layer)}{!layer.enabled ? ' · desactivada' : ''}</p>
          {layer.mode === 'pulse' && <div className={styles.actions} aria-label={`Referencias para capa ${index + 1}`}>{NANO_REFERENCES.map(reference => <button type="button" className={styles.referenceButton} key={reference.hz} aria-pressed={layer.rateHz === reference.hz} onClick={() => updateLayer(layer.id, { rateHz: reference.hz })}>{reference.label}</button>)}</div>}
        </fieldset>)}
      </div>
      <p className={styles.muted}>Los valores inferiores a 1 Hz controlan la pulsación del volumen sobre la portadora audible. Binaural requiere audífonos estéreo. Los niveles de las capas se ajustan juntos para mantener acotada la mezcla.</p>
      <div className={styles.actions}>
        <button type="button" className="fh-action fh-action--secondary" disabled={locked} onClick={saveRecipe}>{selectedId ? 'Guardar cambios de receta' : 'Guardar receta'}</button>
        <button type="button" className="fh-action fh-action--secondary" disabled={locked} onClick={() => { setRecipe(defaultComposition()); setSelectedId(null); setFocusBefore(null); setMessage('Nueva composición lista para editar.'); }}>Nueva composición</button>
      </div>
      <div className={styles.player} id="marina-composer-player">
        {recipe.visual && visualVisible && <div className={styles.composerGeometry} aria-hidden="true"><svg viewBox="0 0 200 160" style={{ transform: `scale(${scale})` }}><ellipse cx="100" cy="80" rx="85" ry="50" /><ellipse cx="100" cy="80" rx="85" ry="24" /><ellipse cx="100" cy="80" rx="40" ry="50" /><ellipse cx="100" cy="80" rx="14" ry="50" /><circle cx="100" cy="80" r="5" /></svg></div>}
        {recipe.actionPlan && active && <ComposerActionGuide plan={recipe.actionPlan} elapsedMs={elapsed} durationMs={durationMs} />}
        <p className={styles.phase}>{({ idle: 'Lista para escuchar', starting: 'Preparando audio…', playing: 'Composición en curso', paused: 'Composición pausada', completed: 'Composición completa', stopped: 'Composición detenida' })[status]}</p>
        <p className={styles.timer} aria-label="Tiempo restante del compositor">{time(Math.max(0, durationMs - elapsed))}</p>
        <progress max={durationMs} value={elapsed} aria-label="Avance del compositor" />
        <label className={styles.field}>Volumen de escucha · {Math.round(volume * 100)} %<input type="range" min="0" max="0.6" step="0.01" value={volume} onChange={event => setVolume(Number(event.target.value))} /></label>
        {recipe.visual && <><p className={styles.muted}>Geometría de atención con movimiento lento; no representa mediciones del cuerpo.</p><button type="button" className="fh-action fh-action--secondary" onClick={() => setVisualVisible(value => !value)}>{visualVisible ? 'Ocultar visual' : 'Mostrar visual'}</button></>}
      </div>
      <div className={styles.actions}>
        {status === 'idle' && <button type="button" className="fh-action fh-action--primary" onClick={() => void play()}>Escuchar composición</button>}
        {status === 'playing' && <button type="button" className="fh-action fh-action--secondary" onClick={pause}>Pausar composición</button>}
        {status === 'paused' && <button type="button" className="fh-action fh-action--primary" onClick={() => void play(true)}>Reanudar composición</button>}
        {active && <button type="button" className="fh-action fh-action--danger" onClick={stop}>Detener composición</button>}
      </div>
      <p className={styles.muted}>Puedes apagar la pantalla: la aplicación mantiene el sonido. Si el teléfono interrumpe el audio, pulsa Reanudar. Para cambiar capas, detén la sesión y guarda o descarta su registro.</p>
    </FHSurface>

    {(status === 'completed' || status === 'stopped') && <FHSurface className="p-5 md:p-7"><h2>Experiencia de la composición</h2>{recipe.actionPlan && <ComposerActionReview plan={recipe.actionPlan} review={practiceReview} onChange={setPracticeReview} />}<label className={styles.field}>Lo que observé<textarea maxLength={6000} value={experience} onChange={event => setExperience(event.target.value)} /></label><div className={styles.actions}><button type="button" className="fh-action fh-action--primary" onClick={saveSession}>Guardar experiencia del compositor</button><button type="button" className="fh-action fh-action--secondary" onClick={resetSession}>Continuar sin guardar experiencia</button></div></FHSurface>}

    <FHSurface className="p-5 md:p-7"><div className={styles.titleRow}><h2>Mis recetas · {saved.length}</h2><button type="button" className="fh-action fh-action--secondary" onClick={() => {
      try { exportJSON({ version: COMPOSER_VERSION, compositions: readCompositions(localStorage), sessions: readComposerSessions(localStorage) }, 'marina-compositor.json'); } catch (error) { setMessage((error as Error).message); }
    }}>Exportar compositor</button></div><p className={styles.muted}>Guardado en este navegador. El volumen de escucha se ajusta por separado; cada receta conserva las capas, sus niveles, la duración, la transición y la intención.</p>{saved.length === 0 && <p>Todavía no has guardado recetas.</p>}{[...saved].reverse().map(row => <article key={row.id} className={styles.savedComposition}><div><h3>{row.recipe.name}</h3><p className={styles.muted}>{row.recipe.durationMinutes} min · {row.recipe.layers.filter(layer => layer.enabled).length} capas activas</p></div><button type="button" className="fh-action fh-action--secondary" disabled={locked} aria-label={`Cargar ${row.recipe.name}`} onClick={() => { setRecipe(structuredClone(row.recipe)); setSelectedId(row.id); setFocusBefore(null); setMessage('Receta cargada. Toca Escuchar composición cuando estés listo.'); }}>Cargar receta</button></article>)}</FHSurface>

    <FHSurface className="p-5 md:p-7"><h2>Diario del compositor · {sessions.length}</h2>{sessions.length === 0 && <p className={styles.muted}>Puedes guardar lo que observes al terminar o detener una composición.</p>}{[...sessions].reverse().map(row => <details className={styles.entry} key={row.id}><summary>{row.recipe.name} · {new Date(row.startedAt).toLocaleString('es-MX')} · {row.status === 'completed' ? 'Completa' : 'Detenida'} · {time(row.elapsedMs)}</summary><p>{row.recipe.intention}</p>{row.recipe.layers.filter(layer => layer.enabled).map(layer => <p key={layer.id}>{layerLabel(layer)} · nivel {Math.round(layer.level * 100)} %</p>)}<p>{row.experience || 'Sin observaciones escritas.'}</p><ComposerActionDiary session={row} onAppend={update => {
      try { setSessions(appendComposerActionFollowUp(localStorage, row.id, update)); return true; }
      catch (error) { setMessage((error as Error).message); return false; }
    }} /></details>)}</FHSurface>

    <FHSurface className="p-5 md:p-7"><h2>Referencias de Nano Technology</h2><p className={styles.muted}>Valores citados por Jacobi para explorar. Las recetas acústicas son una adaptación nuestra; el libro no demuestra efectos terapéuticos ni modificación del ADN.</p><div className={styles.studyGrid}>{NANO_REFERENCES.map(reference => <article key={reference.hz}><h3>{reference.label}</h3><p>{reference.description}</p><p>Página impresa {reference.printedPage}.</p></article>)}</div><a href={NANO_SOURCE} target="_blank" rel="noreferrer">Consultar Nano Technology · The Constructive Elements</a></FHSurface>
    {storageError && <button type="button" className="fh-action fh-action--secondary" onClick={() => {
      try { exportJSON({ recipesOriginal: localStorage.getItem(COMPOSER_RECIPES_KEY), sessionsOriginal: localStorage.getItem(COMPOSER_SESSIONS_KEY) }, 'marina-compositor-original.json'); } catch (error) { setMessage((error as Error).message); }
    }}>Exportar datos originales del compositor</button>}
    {message && <p role="status" className={styles.message}>{message}</p>}
  </>;
}
