'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FHPageHeader, FHPageShell, FHSurface } from '@/components/ui/FHLayout';
import { getAudioEngine } from '@/lib/audioEngine';
import { CrystalAudio } from '@/lib/crystals/audio';
import {
  CRYSTAL_KEY, CRYSTAL_DESIGN_VERSION, CRYSTAL_PURPOSES, CRYSTAL_SOURCES,
  defaultCrystalPreparation, crystalPhases, crystalPhaseAt, crystalTimeline,
  readCrystalNotebook, saveCrystalPreparation, saveCrystalSession, appendCrystalFollowUp, importCrystalNotebook,
  validatePreparation, type CrystalPreparation, type CrystalNotebook, type CrystalNotes, type CrystalSession,
} from '@/lib/crystals/model';
import { useMarinaMediaSession } from '@/components/marina/useMarinaMediaSession';
import styles from './crystals.module.css';

type Status = 'idle' | 'starting' | 'playing' | 'paused' | 'completed' | 'stopped';
type Tab = 'prepare' | 'practice' | 'notebook';
type Snapshot = Pick<CrystalSession, 'id' | 'designVersion' | 'startedAt' | 'preparation' | 'initialVolume'>;
const blankNotes = (): CrystalNotes => ({ experience: '', interpretation: '', action: '' });
const clock = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms % 60000 / 1000)).padStart(2, '0')}`;
function download(value: unknown, name: string, raw = false) {
  const url = URL.createObjectURL(new Blob([raw ? String(value) : JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function CrystalModule() {
  const [tab, setTab] = useState<Tab>('prepare');
  const [preparation, setPreparation] = useState(defaultCrystalPreparation);
  const [baseText, setBaseText] = useState('256');
  const [notebook, setNotebook] = useState<CrystalNotebook>({ schemaVersion: 1, preparation: null, sessions: [] });
  const [session, setSession] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [volume, setVolume] = useState(.12);
  const [voice, setVoice] = useState(false);
  const [voiceVolume, setVoiceVolume] = useState(.7);
  const [notes, setNotes] = useState(blankNotes);
  const [followUps, setFollowUps] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [message, setMessage] = useState('');
  const audio = useRef<CrystalAudio | null>(null);
  const snapshot = useRef<Snapshot | null>(null);
  const elapsedRef = useRef(0);
  const operation = useRef(0);
  const volumeRef = useRef(volume);
  const volumeChanges = useRef<CrystalSession['volumeChanges']>([]);
  const active = status === 'playing' || status === 'paused' || status === 'starting';
  const locked = status !== 'idle';
  const baseValid = baseText.trim() !== '' && Number.isFinite(Number(baseText)) && Number(baseText) >= 80 && Number(baseText) <= 2000;
  const current = session?.preparation ?? preparation;
  const durationMs = current.duration * 60000;
  const phase = crystalPhaseAt(elapsed, current.duration);
  const guide = phase?.guide;
  const coils = current.exposure === 'coils';
  const spoken = guide && phase?.id === 'program' ? `${guide} Tu intención: ${current.intention}` : guide;
  const stopVoice = useCallback(() => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }, []);
  const invalidate = useCallback(() => { operation.current++; }, []);
  const pause = useCallback(() => {
    operation.current++; elapsedRef.current = audio.current?.elapsedMs() ?? elapsedRef.current;
    setElapsed(elapsedRef.current); audio.current?.stop(); stopVoice(); setStatus('paused');
  }, [stopVoice]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { const book = readCrystalNotebook(localStorage); setNotebook(book); if (book.preparation) { setPreparation(book.preparation); setBaseText(String(book.preparation.baseHz)); } }
      catch (error) { setStorageError(true); setMessage((error as Error).message); }
      setReady(true);
    }, 0);
    return () => { clearTimeout(timer); invalidate(); audio.current?.dispose(); stopVoice(); };
  }, [invalidate, stopVoice]);
  useEffect(() => { volumeRef.current = volume; audio.current?.setVolume(volume); }, [volume]);
  useEffect(() => {
    if (status !== 'playing') return;
    const timer = window.setInterval(() => {
      const value = Math.min(durationMs, audio.current?.elapsedMs() ?? elapsedRef.current);
      elapsedRef.current = value; setElapsed(value);
      if (value >= durationMs) {
        operation.current++; audio.current?.stop(); stopVoice(); setStatus('completed');
        setMessage('La preparación terminó. Puedes permanecer en silencio y registrar tu experiencia.');
      }
    }, 150);
    return () => clearInterval(timer);
  }, [status, durationMs, stopVoice]);
  useEffect(() => {
    if (status !== 'playing' || !voice || coils || !spoken || document.hidden || !('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(spoken);
    utterance.lang = 'es-MX'; utterance.rate = .88; utterance.volume = voiceVolume;
    const spanish = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('es'));
    if (spanish) utterance.voice = spanish;
    utterance.onerror = event => { if (!['canceled', 'interrupted'].includes(event.error)) setMessage('La voz no está disponible. La guía escrita sigue visible.'); };
    window.speechSynthesis.speak(utterance);
    return () => { utterance.onerror = null; stopVoice(); };
  }, [spoken, status, voice, voiceVolume, coils, stopVoice]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) stopVoice(); };
    document.addEventListener('visibilitychange', hidden);
    return () => document.removeEventListener('visibilitychange', hidden);
  }, [stopVoice]);
  async function play(resume = false) {
    const ticket = ++operation.current;
    try {
      if (!resume) {
        if (snapshot.current) return;
        if (!baseValid) throw new Error('Elige un tono base de 80 a 2000 Hz.');
        validatePreparation(preparation, true);
        const next: Snapshot = { id: crypto.randomUUID(), designVersion: CRYSTAL_DESIGN_VERSION, startedAt: new Date().toISOString(), preparation: structuredClone(preparation), initialVolume: volume };
        snapshot.current = next; volumeChanges.current = []; setSession(next); elapsedRef.current = 0; setElapsed(0); setNotes(blankNotes());
      }
      if (!snapshot.current) return;
      setStatus('starting'); setTab('practice'); setMessage('');
      audio.current ??= new CrystalAudio(undefined, () => getAudioEngine().stop(), () => { pause(); setMessage('El dispositivo interrumpió el audio. La sesión se pausó; puedes reanudarla.'); });
      const started = await audio.current.play(snapshot.current.preparation, volumeRef.current, elapsedRef.current);
      if (!started || ticket !== operation.current) return;
      setStatus('playing');
      if (voice && snapshot.current.preparation.exposure !== 'coils' && !('speechSynthesis' in window)) setMessage('La voz no está disponible en este navegador. Utiliza la guía escrita.');
    } catch (error) {
      if (ticket === operation.current) { audio.current?.stop(); setStatus(snapshot.current ? 'paused' : 'idle'); setMessage((error as Error).message); }
    }
  }
  function stop() {
    operation.current++; elapsedRef.current = Math.min(durationMs, audio.current?.elapsedMs() ?? elapsedRef.current);
    setElapsed(elapsedRef.current); audio.current?.stop(); stopVoice(); setStatus('stopped');
    setMessage('Sesión detenida. Puedes guardar el tramo realizado.');
  }
  function reset() { snapshot.current = null; setSession(null); setStatus('idle'); elapsedRef.current = 0; setElapsed(0); setNotes(blankNotes()); }
  function saveSession() {
    if (!snapshot.current) return;
    const row: CrystalSession = { ...snapshot.current, endedAt: new Date().toISOString(), status: status === 'completed' ? 'completed' : 'stopped', elapsedMs: Math.round(Math.min(durationMs, elapsedRef.current)), notes: { ...notes }, followUps: [], volumeChanges: structuredClone(volumeChanges.current) };
    try { setNotebook(saveCrystalSession(localStorage, row)); reset(); setStorageError(false); setMessage('Sesión guardada con la ficha del cristal, intención y secuencia sonora.'); }
    catch (error) { setMessage(`${(error as Error).message} Puedes conservar la sesión en el archivo de recuperación.`); download({ schemaVersion: 1, preparation: null, sessions: [row] }, 'cristales-sesion-recuperacion.json'); }
  }
  function savePreparation() {
    try { setNotebook(saveCrystalPreparation(localStorage, preparation)); setStorageError(false); setMessage('Preparación guardada en este navegador.'); }
    catch (error) { setMessage((error as Error).message); }
  }
  useMarinaMediaSession(`Cristales · ${current.crystal || 'Preparación'}`, durationMs, elapsed, active, status === 'playing', {
    play: () => { if (status === 'paused') void play(true); },
    pause: () => { if (status === 'playing' || status === 'starting') pause(); },
    stop: () => { if (active) stop(); },
  });
  const update = <K extends keyof CrystalPreparation>(key: K, value: CrystalPreparation[K]) => setPreparation(p => ({ ...p, [key]: value }));
  const sounding = crystalTimeline(current).some(step => step.tones.length > 0);
  const stageTones = (() => {
    let boundary = 0;
    for (const step of crystalTimeline(current)) { boundary += step.seconds * 1000; if (elapsed < boundary) return step.tones.map(t => t.hz); }
    return [];
  })();

  return <FHPageShell width="wide"><FHPageHeader eyebrow="Explorar · intención, sonido y herramientas" title="Preparación de cristales" description="Prepara tu herramienta, define una intención y recorre una secuencia de sonido, imagen y silencio." />
    <div className={styles.module}>
      <div className={styles.tabs} role="group" aria-label="Áreas de cristales">{([['prepare', 'Preparar'], ['practice', 'Guía y sonido'], ['notebook', 'Mi cuaderno']] as const).map(([id, label]) => <button type="button" key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>
      <p className={styles.muted}>Práctica exploratoria de manifestación. La intención la defines tú; el cristal acompaña el proceso. Los tonos y tiempos son diseños de Resonance Lab inspirados en el estudio de Cannon y Vogel.</p>
      {tab === 'prepare' && <FHSurface className="p-5 md:p-7"><div className={styles.heading}><h2>Tu herramienta y su función</h2><span className={styles.tag}>Una intención por sesión</span></div>
        <div className={styles.fields}>
          <label className={styles.field}>Nombre de mi cristal<input disabled={locked} maxLength={120} value={preparation.crystal} placeholder="Ej. Mi cuarzo de escritorio" onChange={e => update('crystal', e.target.value)} /></label>
          <label className={styles.field}>Material o tipo<input disabled={locked} maxLength={120} value={preparation.material} placeholder="Cuarzo, tipo Vogel, amatista o desconocido" onChange={e => update('material', e.target.value)} /></label>
          <label className={styles.field}>Función de esta preparación<select disabled={locked} value={preparation.purpose} onChange={e => update('purpose', e.target.value as CrystalPreparation['purpose'])}>{CRYSTAL_PURPOSES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
          <label className={styles.field}>Recorrido<select disabled={locked} value={preparation.duration} onChange={e => update('duration', Number(e.target.value) as 10 | 15)}><option value={15}>15 minutos · preparación completa</option><option value={10}>10 minutos · preparación breve</option></select></label>
        </div>
        <label className={styles.field}>Intención o frase<textarea disabled={locked} maxLength={6000} value={preparation.intention} placeholder="¿Para qué quiero utilizar esta herramienta?" onChange={e => update('intention', e.target.value)} /></label>
        <button type="button" className="fh-action fh-action--secondary" disabled={locked} onClick={() => update('intention', CRYSTAL_PURPOSES.find(p => p.id === preparation.purpose)!.phrase)}>Usar frase de partida</button>
        <label className={styles.field}>Escena que representa mi intención<textarea disabled={locked} maxLength={6000} value={preparation.scene} placeholder="Describe una escena concreta y el sentimiento que la acompaña." onChange={e => update('scene', e.target.value)} /></label>
        <label className={styles.field}>Posición y características de la pieza<textarea disabled={locked} maxLength={6000} value={preparation.details} placeholder="Forma, tamaño aproximado, soporte y posición durante la práctica." onChange={e => update('details', e.target.value)} /></label>
        <div className={styles.actions}><button type="button" disabled={locked || !ready || !baseValid} className="fh-action fh-action--secondary" onClick={savePreparation}>Guardar preparación</button><button type="button" className="fh-action fh-action--primary" onClick={() => setTab('practice')}>Revisar sonido y comenzar</button></div>
        {locked && <p className={styles.muted}>La ficha de la sesión está fijada. Guarda o descarta el tramo antes de preparar otro.</p>}
      </FHSurface>}
      {tab === 'practice' && <FHSurface className="p-5 md:p-7"><div className={styles.heading}><h2>{current.duration} minutos · preparar, dirigir y estabilizar</h2><span className={styles.tag}>Composición propia</span></div>
        <p className={styles.intention}>{current.intention || 'Escribe tu intención en Preparar antes de comenzar.'}</p>
        {current.scene && <p className={styles.muted}>{current.scene}</p>}
        <div className={styles.fields}>
          <label className={styles.field}>Tono base (Hz)<input type="number" min={80} max={2000} step="any" disabled={locked} value={baseText} aria-invalid={!baseValid} onChange={e => { const raw = e.target.value, n = Number(raw); setBaseText(raw); if (raw.trim() && Number.isFinite(n) && n >= 80 && n <= 2000) update('baseHz', n); }} /></label>
          <label className={styles.field}>Salida de sonido<select disabled={locked} value={preparation.exposure} onChange={e => {
            const output = e.target.value as CrystalPreparation['exposure']; update('exposure', output);
            if (output === 'coils') { setVoice(false); stopVoice(); }
          }}><option value="speaker">Altavoz · exposición del entorno</option><option value="headphones">Audífonos · escucha personal</option><option value="coils">Mis coils · conexión de audio</option><option value="voice">Voz propia / silencio · sin tonos generados</option></select></label>
          <label className={styles.check}><input type="checkbox" disabled={locked || preparation.exposure === 'voice'} checked={preparation.sound} onChange={e => update('sound', e.target.checked)} /> Acompañamiento sonoro</label>
          <label className={styles.field}>Volumen de tonos · {Math.round(volume * 100)} %<input type="range" min="0" max=".6" step=".01" value={volume} disabled={status === 'starting' || status === 'completed' || status === 'stopped'} onChange={e => {
            const value = Number(e.target.value);
            if (active) volumeChanges.current.push({ elapsedMs: audio.current?.elapsedMs() ?? elapsedRef.current, level: value });
            volumeRef.current = value; audio.current?.setVolume(value); setVolume(value);
          }} /></label>
          <label className={styles.check}><input type="checkbox" disabled={coils} checked={voice && !coils} onChange={e => { setVoice(e.target.checked); if (!e.target.checked) stopVoice(); }} /> Leer instrucciones con voz</label>
          <label className={styles.field}>Volumen de guía · {Math.round(voiceVolume * 100)} %<input type="range" disabled={coils} min="0" max="1" step=".05" value={voiceVolume} onChange={e => setVoiceVolume(Number(e.target.value))} /></label>
        </div>
        {coils && <p className={styles.message}><strong>Mis coils:</strong> conecta el controlador de tus coils a la salida de audio según sus instrucciones y elige la salida cableada o USB en tu teléfono o computadora. Empieza con el nivel mínimo del controlador. La aplicación genera la misma secuencia de tonos; no detecta ni selecciona físicamente el equipo. La guía permanece escrita para que la narración no se envíe a las bobinas.</p>}
        {!baseValid && <p role="alert">El tono base debe estar entre 80 y 2000 Hz.</p>}
        <p className={styles.muted}>{sounding ? `${current.baseHz} · ${current.baseHz * 1.5} · ${current.baseHz * 2} Hz. Base, quinta y octava; amplitudes relativas 1 : 0.5 : 0.25, mezcladas con nivel limitado.` : 'Sin tonos generados. Puedes vocalizar suavemente en una exhalación cómoda o permanecer en silencio.'} Los valores son una elección musical; no identifican la resonancia física ni una carga medida del cristal.</p>
        <div className={styles.player}><div className={`${styles.orb} ${status === 'playing' ? styles.moving : ''}`} aria-hidden="true">◇</div><h3>{status === 'completed' ? 'Preparación terminada' : phase?.title ?? 'Sesión terminada'}</h3><p className={styles.timer} aria-label="Tiempo restante">{clock(Math.max(0, durationMs - elapsed))}</p><progress max={durationMs} value={elapsed} aria-label="Avance de la sesión" /><p>{status === 'completed' || !stageTones.length ? 'Silencio' : `${stageTones.join(' · ')} Hz`}</p>{phase && <p className={styles.guide}>{phase.guide}</p>}</div>
        <div className={styles.actions}>
          {status === 'idle' && <button type="button" disabled={!ready || !baseValid} className="fh-action fh-action--primary" onClick={() => void play()}>Comenzar preparación</button>}
          {status === 'playing' && <button type="button" className="fh-action fh-action--secondary" onClick={pause}>Pausar</button>}
          {status === 'paused' && <button type="button" className="fh-action fh-action--primary" onClick={() => void play(true)}>Reanudar</button>}
          {status === 'starting' && <span role="status">Preparando audio…</span>}
          {active && <button type="button" className="fh-action fh-action--danger" onClick={stop}>Detener</button>}
        </div>
        <p className={styles.muted}>Las transiciones sonoras están programadas para continuar si el navegador mantiene el audio al bloquear la pantalla. Si el dispositivo lo interrumpe, reanuda aquí. La guía de voz se detiene al ocultar la página.</p>
        <ol className={styles.score}>{crystalPhases(current.duration).map(p => <li key={p.id} aria-current={phase?.id === p.id ? 'step' : undefined}><strong>{p.title}</strong><span>{p.seconds / 60} min</span></li>)}</ol>
      </FHSurface>}
      {(status === 'completed' || status === 'stopped') && <FHSurface className="p-5 md:p-7"><h2>Conserva tu experiencia</h2>{(['experience', 'interpretation', 'action'] as const).map(key => <label key={key} className={styles.field}>{({ experience: 'Lo que observé o sentí', interpretation: 'Mi interpretación y preguntas abiertas', action: 'Acción que corresponde a mi intención' })[key]}<textarea maxLength={6000} value={notes[key]} onChange={e => setNotes(n => ({ ...n, [key]: e.target.value }))} /></label>)}<div className={styles.actions}><button type="button" className="fh-action fh-action--primary" onClick={saveSession}>Guardar sesión en el cuaderno</button><button type="button" className="fh-action fh-action--secondary" onClick={() => { reset(); setMessage('Tramo descartado. Las sesiones guardadas se conservan.'); }}>Descartar tramo sin guardar</button></div></FHSurface>}
      {tab === 'notebook' && <FHSurface className="p-5 md:p-7"><div className={styles.heading}><h2>Mi cuaderno · {notebook.sessions.length} sesiones</h2><button type="button" className="fh-action fh-action--secondary" onClick={() => { try { download(readCrystalNotebook(localStorage), 'resonance-lab-cristales.json'); } catch (error) { setMessage((error as Error).message); } }}>Exportar cuaderno</button></div>
        <p className={styles.muted}>Tus fichas y experiencias se guardan en este navegador. Para llevarlas a otro dispositivo, exporta e importa el archivo; no hay sincronización automática. Las secuencias de partida están disponibles al abrir el módulo en cualquier dispositivo.</p>
        <label className={styles.field}>Importar cuaderno<input type="file" accept="application/json,.json" disabled={active || !ready} onChange={e => {
          const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
          if (file.size > 5_000_000) { setMessage('El archivo supera 5 MB.'); return; }
          void file.text().then(raw => { const book = importCrystalNotebook(localStorage, raw); setNotebook(book); if (!locked && book.preparation) { setPreparation(book.preparation); setBaseText(String(book.preparation.baseHz)); } setStorageError(false); setMessage('Cuaderno importado. Las sesiones existentes se conservaron.'); }).catch(error => setMessage((error as Error).message));
        }} /></label>
        {!notebook.sessions.length && <p className={styles.muted}>Aquí aparecerán las sesiones que decidas guardar.</p>}
        {[...notebook.sessions].reverse().map(row => <details className={styles.entry} key={row.id}><summary>{row.preparation.crystal} · {new Date(row.startedAt).toLocaleString('es-MX')} · {clock(row.elapsedMs)} · {row.status === 'completed' ? 'Completa' : 'Detenida'}</summary><p><strong>Intención:</strong> {row.preparation.intention}</p><p><strong>Escena:</strong> {row.preparation.scene || 'Sin registrar'}</p><p><strong>Pieza:</strong> {row.preparation.material} · {row.preparation.details || 'Sin detalles'}</p><p><strong>Volumen inicial:</strong> {Math.round(row.initialVolume * 100)} % · {row.volumeChanges.length} ajustes registrados</p><p><strong>Secuencia:</strong> {row.preparation.duration} min · {row.preparation.sound && row.preparation.exposure !== 'voice' ? `${row.preparation.baseHz} / ${row.preparation.baseHz * 1.5} / ${row.preparation.baseHz * 2} Hz` : 'Sin tonos'} · {row.preparation.exposure === 'speaker' ? 'Altavoz' : row.preparation.exposure === 'headphones' ? 'Audífonos' : row.preparation.exposure === 'coils' ? 'Mis coils · audio' : 'Voz propia / silencio'}</p>{Object.entries(row.notes).filter(([, value]) => value).map(([key, value]) => <p key={key}><strong>{({ experience: 'Experiencia', interpretation: 'Interpretación', action: 'Acción' })[key as keyof CrystalNotes]}:</strong> {value}</p>)}{row.followUps.map(f => <p key={f.id}><strong>{new Date(f.at).toLocaleString('es-MX')}:</strong> {f.text}</p>)}<label className={styles.field}>Observación posterior<textarea maxLength={6000} value={followUps[row.id] ?? ''} onChange={e => setFollowUps(f => ({ ...f, [row.id]: e.target.value }))} /></label><button type="button" disabled={!followUps[row.id]?.trim()} className="fh-action fh-action--secondary" onClick={() => { try { setNotebook(appendCrystalFollowUp(localStorage, row.id, { id: crypto.randomUUID(), at: new Date().toISOString(), text: followUps[row.id].trim() })); setFollowUps(f => ({ ...f, [row.id]: '' })); setMessage('Observación añadida con fecha.'); } catch (error) { setMessage((error as Error).message); } }}>Guardar observación</button></details>)}
      </FHSurface>}
      <FHSurface variant="subtle" className="p-5 md:p-7"><details><summary>Fundamento, fuentes y cuidado de la herramienta</summary><div className={styles.cards}>{CRYSTAL_SOURCES.map(source => <article key={source.title}><h3>{source.title}</h3><p className={styles.muted}>{source.text}</p>{source.href && <a href={source.href} target="_blank" rel="noreferrer">Consultar fuente</a>}</article>)}</div><p className={styles.muted}>«Programación» y «carga» nombran aquí una práctica intencional de exploración. El progreso indica tiempo de sesión, no energía almacenada. Conserva una respiración cómoda y un volumen bajo. La pieza se utiliza como herramienta; tú eliges su función.</p><Link href="/marina-punto-cero">Abrir Marina · Punto Cero y el compositor</Link></details></FHSurface>
      {storageError && <button type="button" className="fh-action fh-action--secondary" onClick={() => { try { download(localStorage.getItem(CRYSTAL_KEY) ?? '', 'cristales-cuaderno-original.json', true); } catch (error) { setMessage((error as Error).message); } }}>Exportar datos originales sin modificar</button>}
      {message && <p role="status" className={styles.message}>{message}</p>}
    </div>
  </FHPageShell>;
}
