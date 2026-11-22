'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FHPageHeader, FHPageShell, FHSurface } from '@/components/ui/FHLayout';
import { getAudioEngine } from '@/lib/audioEngine';
import { MarinaAudio } from '@/lib/marina/audio';
import {
  DEFAULT_MARINA_CONFIG, MARINA_FREQUENCIES, MARINA_SOURCES,
  MARINA_STORAGE_KEY, MARINA_VERSION, MarinaClock, MARINA_BOOK_CARDS,
  marinaPhases, marinaDuration, addMarinaFollowUp,
  marinaAudioLabel, marinaPhaseAt, readMarinaRecords, saveMarinaRecord, validateMarinaAudio,
  type MarinaAudioConfig, type MarinaMode, type MarinaNotes, type MarinaRecord, type MarinaProtocol, type MarinaPractice,
} from '@/lib/marina/model';
import styles from './marina.module.css';
import MarinaPhrase from './MarinaPhrase';
import MarinaComposer from './MarinaComposer';
import { useMarinaMediaSession } from './useMarinaMediaSession';

type Status = 'idle' | 'starting' | 'playing' | 'paused' | 'finished' | 'stopped';
type Tab = 'guided' | 'free' | 'composer' | 'study' | 'journal';
type MarinaSession = Omit<MarinaRecord, 'endedAt' | 'status' | 'elapsedMs' | 'notes'>;
const EMPTY_NOTES: MarinaNotes = { intention: '', experience: '', interpretation: '', events: '', action: '' };
const time = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms % 60000 / 1000)).padStart(2, '0')}`;
function download(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function MarinaModule({ initialTab = 'guided' }: { initialTab?: Tab } = {}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [status, setStatus] = useState<Status>('idle');
  const [config, setConfig] = useState<MarinaAudioConfig>({ ...DEFAULT_MARINA_CONFIG });
  const [sound, setSound] = useState(true);
  const [voice, setVoice] = useState(false);
  const [voiceVolume, setVoiceVolume] = useState(.7);
  const [volume, setVolume] = useState(.15);
  const [protocol, setProtocol] = useState<MarinaProtocol>('classic24');
  const [practice, setPractice] = useState<MarinaPractice>({ statement: '', scene: '', feeling: '' });
  const [phraseBusy, setPhraseBusy] = useState(false);
  const [composerBusy, setComposerBusy] = useState(false);
  const [hasPhrase, setHasPhrase] = useState(false);
  const [followUpDrafts, setFollowUpDrafts] = useState<Record<string, string>>({});
  const [minutes, setMinutes] = useState(20);
  const [elapsed, setElapsed] = useState(0);
  const [notes, setNotes] = useState<MarinaNotes>({ ...EMPTY_NOTES });
  const [records, setRecords] = useState<MarinaRecord[]>([]);
  const [message, setMessage] = useState('');
  const [storageError, setStorageError] = useState(false);
  const [sessionView, setSessionView] = useState<MarinaSession | null>(null);
  const [sessionDurationMs, setSessionDurationMs] = useState<number | null>(null);
  const audioRef = useRef<MarinaAudio | null>(null);
  const clockRef = useRef<MarinaClock | null>(null);
  const sessionRef = useRef<MarinaSession | null>(null);
  const operation = useRef(0);
  const volumeRef = useRef(volume);
  const active = status === 'playing' || status === 'starting' || status === 'paused';
  const guided = sessionView?.kind === 'guided' || (!sessionView && tab === 'guided');
  const selectedProtocol = sessionView?.protocol ?? protocol;
  const phases = marinaPhases(selectedProtocol);
  const phase = guided ? marinaPhaseAt(elapsed, selectedProtocol) : null;
  const phaseGuide = phase?.guide;
  const phrasePlayback = status === 'playing' && guided && phase?.id === 'express' && hasPhrase;
  const total = sessionDurationMs ?? (tab === 'guided' ? marinaDuration(protocol) : minutes * 60000);

  const invalidatePending = useCallback(() => { operation.current += 1; }, []);
  const stopSpeech = useCallback(() => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }, []);
  const pause = useCallback(() => {
    operation.current++;
    clockRef.current?.pause(performance.now());
    audioRef.current?.stop(); stopSpeech(); setStatus('paused');
  }, [stopSpeech]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { setRecords(readMarinaRecords(localStorage)); }
      catch (error) { setStorageError(true); setMessage((error as Error).message); }
    }, 0);
    return () => { window.clearTimeout(timer); invalidatePending(); audioRef.current?.dispose(); stopSpeech(); };
  }, [invalidatePending, stopSpeech]);
  useEffect(() => { volumeRef.current = volume; audioRef.current?.setVolume(volume); }, [volume]);
  useEffect(() => {
    if (status !== 'playing') return;
    const id = window.setInterval(() => {
      const clock = clockRef.current;
      if (!clock) return;
      const now = performance.now(), value = clock.tick(now);
      setElapsed(value);
      if (value >= clock.durationMs) {
        clock.pause(now); operation.current++; audioRef.current?.stop(); stopSpeech();
        setStatus('finished'); setMessage('La práctica terminó. Puedes registrar tu experiencia y guardar.');
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [status, stopSpeech]);
  useEffect(() => {
    if (status !== 'playing' || !voice || !phaseGuide || phrasePlayback) return;
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(phaseGuide);
    utterance.lang = 'es-MX'; utterance.rate = .88; utterance.volume = voiceVolume;
    const spanish = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('es'));
    if (spanish) utterance.voice = spanish;
    utterance.onerror = event => {
      if (event.error !== 'canceled' && event.error !== 'interrupted') setMessage('No se pudo reproducir la voz. Puedes continuar con la instrucción escrita.');
    };
    window.speechSynthesis.speak(utterance);
    return () => { utterance.onerror = null; stopSpeech(); };
  }, [phaseGuide, status, voice, voiceVolume, phrasePlayback, stopSpeech]); // A guide speaks once per phase.

  async function start(resume = false) {
    const ticket = ++operation.current;
    try {
      if (!resume) {
        if (sessionRef.current) { setMessage('Guarda o descarta la sesión anterior antes de comenzar otra.'); return; }
        const kind = tab === 'guided' ? 'guided' : 'free';
        const initialConfig: MarinaAudioConfig = kind === 'guided' ? { mode: phases[0].mode, hz: phases[0].hz, carrierHz: config.carrierHz } : { ...config };
        validateMarinaAudio(initialConfig);
        if (kind === 'free' && (!Number.isFinite(minutes) || minutes < 1 || minutes > 240)) throw new Error('Elige una duración entre 1 y 240 minutos.');
        const session: MarinaSession = { id: crypto.randomUUID(), version: MARINA_VERSION, startedAt: new Date().toISOString(), kind, config: initialConfig, soundEnabled: sound, ...(kind === 'guided' ? { protocol, practice: { ...practice } } : {}) };
        const durationMs = kind === 'guided' ? marinaDuration(protocol) : minutes * 60000;
        sessionRef.current = session;
        setSessionView(session);
        setSessionDurationMs(durationMs);
        clockRef.current = new MarinaClock(durationMs);
        setElapsed(0);
      }
      const session = sessionRef.current;
      if (!session) return;
      setStatus('starting'); setMessage('');
      if (!audioRef.current) audioRef.current = new MarinaAudio(undefined, () => getAudioEngine().stop(), () => {
        pause(); setMessage('El dispositivo interrumpió el audio. La práctica se pausó; puedes reanudarla.');
      });
      const steps = session.kind === 'guided'
        ? marinaPhases(session.protocol).map(item => ({ seconds: item.seconds, config: { mode: session.soundEnabled ? item.mode : 'silence', hz: item.hz, carrierHz: session.config.carrierHz } as MarinaAudioConfig }))
        : [{ seconds: (clockRef.current?.durationMs ?? 0) / 1000, config: session.soundEnabled ? session.config : { ...session.config, mode: 'silence' as const } }];
      const started = await audioRef.current.playTimeline(steps, volumeRef.current, clockRef.current?.elapsedMs ?? 0);
      if (!started || ticket !== operation.current) return;
      clockRef.current?.resume(performance.now()); setStatus('playing');
      if (voice && !('speechSynthesis' in window)) setMessage('La voz no está disponible en este navegador. Las instrucciones siguen visibles.');
    } catch (error) {
      if (ticket === operation.current) { audioRef.current?.stop(); setStatus(sessionRef.current ? 'paused' : 'idle'); setMessage((error as Error).message); }
    }
  }
  function finish() {
    operation.current++; clockRef.current?.pause(performance.now()); audioRef.current?.stop(); stopSpeech();
    setElapsed(clockRef.current?.elapsedMs ?? 0); setStatus('stopped'); setMessage('Sesión detenida. Puedes guardar lo que experimentaste.');
  }
  function save() {
    if (!sessionRef.current) return;
    const record: MarinaRecord = { ...sessionRef.current, endedAt: new Date().toISOString(), status: status === 'finished' ? 'completed' : 'stopped', elapsedMs: Math.round(clockRef.current?.elapsedMs ?? 0), notes: { ...notes } };
    try {
      setRecords(saveMarinaRecord(localStorage, record)); setStorageError(false);
      sessionRef.current = null; clockRef.current = null; setSessionView(null); setSessionDurationMs(null); setStatus('idle'); setElapsed(0);
      setNotes({ ...EMPTY_NOTES, intention: notes.intention }); setMessage('Sesión guardada en este navegador.');
    } catch (error) { setMessage(`${(error as Error).message} Descarga esta sesión para conservarla.`); download(JSON.stringify(record, null, 2), 'marina-sesion-recuperacion.json'); }
  }
  function discard() { sessionRef.current = null; clockRef.current = null; setSessionView(null); setSessionDurationMs(null); setStatus('idle'); setElapsed(0); setMessage('Sesión descartada; el diario guardado se conserva.'); }
  const actualConfig: MarinaAudioConfig = phase && sessionView?.kind === 'guided' ? { mode: phase.mode, hz: phase.hz, carrierHz: sessionView.config.carrierHz } : sessionView?.config ?? config;
  useMarinaMediaSession(tab === 'guided' ? `Punto Cero · ${selectedProtocol === 'creation12' ? '12' : '24'} minutos` : 'Punto Cero · Frecuencias libres', total, elapsed, active, status === 'playing', {
    play: () => { if (status === 'paused') void start(true); },
    pause: () => { if (status === 'playing' || status === 'starting') pause(); },
    stop: () => { if (active) finish(); },
  });

  return <FHPageShell width="wide">
    <FHPageHeader eyebrow="Exploración personal · Marina Jacobi" title="Punto Cero" description="Explora sonido, emoción e imagen. Construye tu escena, suéltala y conserva tus experiencias con tus propias palabras." />
    <div className={styles.module}>
      <div className={styles.tabs} role="group" aria-label="Áreas del módulo">
        {([['guided', 'Práctica guiada'], ['free', 'Frecuencias libres'], ['composer', 'Compositor'], ['study', 'Cuaderno de estudio'], ['journal', 'Mi diario']] as const).map(([id, title]) => <button type="button" key={id} aria-pressed={tab === id} disabled={active || phraseBusy || composerBusy} onClick={() => setTab(id)}>{title}</button>)}
      </div>
      {tab === 'composer' && <MarinaComposer onBusy={setComposerBusy} />}
      {(tab === 'guided' || tab === 'free') && <>
        <FHSurface className="p-5 md:p-7">
          <div className={styles.titleRow}><div><p className={styles.eyebrow}>{tab === 'guided' ? `Recorrido de ${marinaDuration(selectedProtocol) / 60000} minutos` : 'Una frecuencia a la vez'}</p><h2>{tab === 'guided' ? 'Quietud · emoción · imagen · soltar' : 'Tu exploración sonora'}</h2></div><span className={styles.tag}>Adaptación acústica</span></div>
          <p className={styles.muted}>La guía y la secuencia sonora son una composición nuestra inspirada en Marina. Sus propuestas originales se conservan en el cuaderno de estudio.</p>
          {tab === 'guided' && <label className={styles.field}>Elegir práctica<select disabled={active || status !== 'idle' || phraseBusy} value={protocol} onChange={e => setProtocol(e.target.value as MarinaProtocol)}><option value="classic24">24 minutos · Recorrido original del módulo</option><option value="creation12">12 minutos · Neutralidad y creación</option></select></label>}
          {tab === 'free' && <div className={styles.frequencyGrid}>{MARINA_FREQUENCIES.map(f => <button type="button" disabled={active} key={f.hz} aria-pressed={config.hz === f.hz} onClick={() => setConfig(c => ({ ...c, hz: f.hz }))}><strong>{f.hz} <small>Hz</small></strong><span>{f.name}</span></button>)}</div>}
          <div className={styles.fields}>
            {tab === 'free' && <><label>Forma de audio<select disabled={active} value={config.mode} onChange={e => setConfig(c => ({ ...c, mode: e.target.value as MarinaMode }))}><option value="pulse">Pulso sobre portadora</option><option value="binaural">Binaural estéreo</option><option value="direct">Tono directo</option><option value="silence">Silencio</option></select></label><label>Frecuencia o diferencia (Hz)<input disabled={active} type="number" min="0.01" step="any" value={config.hz} onChange={e => setConfig(c => ({ ...c, hz: Number(e.target.value) }))} /></label></>}
            <label>Portadora audible (Hz)<input disabled={active} type="number" min="20" step="any" value={config.carrierHz} onChange={e => setConfig(c => ({ ...c, carrierHz: Number(e.target.value) }))} /></label>
            {tab === 'free' && <label>Duración (minutos)<input disabled={active} type="number" min="1" max="240" step="1" value={minutes} onChange={e => setMinutes(Number(e.target.value))} /></label>}
            <label>Volumen del sonido · {Math.round(volume * 100)} %<input type="range" min="0" max=".6" step=".01" value={volume} onChange={e => setVolume(Number(e.target.value))} /></label>
            <label className={styles.check}><input disabled={active} type="checkbox" checked={sound} onChange={e => setSound(e.target.checked)} /> Acompañamiento sonoro</label>
            {tab === 'guided' && <><label className={styles.check}><input type="checkbox" checked={voice} onChange={e => { setVoice(e.target.checked); if (!e.target.checked) stopSpeech(); }} /> Voz del navegador</label><label>Volumen de voz · {Math.round(voiceVolume * 100)} %<input disabled={active} type="range" min="0" max="1" step=".05" value={voiceVolume} onChange={e => setVoiceVolume(Number(e.target.value))} /></label></>}
          </div>
          <p className={styles.muted}>Binaural: usa audífonos estéreo. Los tonos directos muy graves pueden sentirse débiles o no oírse; conserva un volumen cómodo. La voz depende de las voces instaladas en tu dispositivo.</p>
          <label className={styles.field}>Mi intención<textarea maxLength={6000} value={notes.intention} placeholder="¿Qué deseo explorar o crear?" onChange={e => setNotes(n => ({ ...n, intention: e.target.value }))} /></label>
          {tab === 'guided' && <>
            <div className={styles.fields}>{(['statement', 'scene', 'feeling'] as const).map(key => <label className={styles.field} key={key}>{({ statement: 'Mi frase', scene: 'La escena que elijo', feeling: 'El sentimiento que acompaña' })[key]}<textarea disabled={status !== 'idle'} maxLength={6000} value={practice[key]} onChange={e => setPractice(p => ({ ...p, [key]: e.target.value }))} /></label>)}</div>
            <MarinaPhrase active={active} autoPlay={phrasePlayback} volume={voiceVolume} onBusy={setPhraseBusy} onAvailable={setHasPhrase} />
          </>}
          <div className={styles.player}>
            <div className={`${styles.orb} ${status === 'playing' ? styles.moving : ''}`} aria-hidden="true"><span>{status === 'idle' ? '◇' : Math.ceil((total - elapsed) / 60000)}</span></div>
            <p className={styles.phase}>{status === 'finished' ? 'Práctica completa' : phase && guided ? phase.name : 'Exploración libre'}</p>
            <p className={styles.timer} aria-label="Tiempo restante">{time(Math.max(0, total - elapsed))}</p>
            <progress max={total} value={elapsed} aria-label="Avance de la práctica" />
            <p>{sessionView?.soundEnabled === false || (!sessionView && !sound) ? 'Silencio' : marinaAudioLabel(actualConfig)}</p>
            {phase && guided && <p className={styles.guide}>{phase.guide}</p>}
          </div>
          <div className={styles.actions}>
            {status === 'idle' && <button type="button" className="fh-action fh-action--primary" disabled={phraseBusy} onClick={() => void start()}>Comenzar {tab === 'guided' ? `${marinaDuration(protocol) / 60000} minutos` : 'exploración'}</button>}
            {status === 'playing' && <button type="button" className="fh-action fh-action--secondary" onClick={pause}>Pausar</button>}
            {status === 'paused' && <button type="button" className="fh-action fh-action--primary" onClick={() => void start(true)}>Reanudar</button>}
            {status === 'starting' && <span role="status">Preparando audio…</span>}
            {active && <button type="button" className="fh-action fh-action--danger" onClick={finish}>Detener</button>}
          </div>
          <p className={styles.muted}>Puedes apagar la pantalla: la aplicación mantiene la secuencia sonora. La voz del navegador depende del dispositivo. Si el teléfono interrumpe el audio, pulsa Reanudar.</p>
        </FHSurface>
        {tab === 'guided' && <FHSurface className="p-5 md:p-7"><h2>El recorrido</h2><ol className={styles.phases}>{phases.map(p => <li key={p.id}><strong>{p.name}</strong><span>{p.seconds / 60} min · {p.mode === 'silence' ? 'silencio' : `${p.hz} Hz · ${p.mode === 'binaural' ? 'diferencia binaural' : 'pulso'}`}</span><p>{p.guide}</p></li>)}</ol></FHSurface>}
      </>}
      {tab === 'study' && <>
        <FHSurface className="p-5 md:p-7"><p className={styles.eyebrow}>The Scientific Download · lectura del libro</p><h2>Principios y referencias originales</h2><p className={styles.muted}>Páginas del contador PDF. Conservamos las propuestas de Marina y explicamos la adaptación utilizada aquí.</p><div className={styles.studyGrid}>{MARINA_BOOK_CARDS.map(card => <article key={card.page}><h3>{card.title}</h3><p>{card.original}</p><p><strong>En esta aplicación:</strong> {card.application}</p><a href={`${MARINA_SOURCES.scientific}#page=${card.page}`} target="_blank" rel="noreferrer">Leer página {card.page} del PDF</a></article>)}</div></FHSurface>
        <FHSurface className="p-5 md:p-7"><p className={styles.eyebrow}>Propuestas de Marina</p><h2>Su mapa de frecuencias</h2><p className={styles.muted}>Funciones atribuidas por Marina a los números y campos en The Harmonic Reactor. Las recetas de reproducción de esta aplicación son nuestras.</p><div className={styles.studyGrid}>{MARINA_FREQUENCIES.map(f => <article key={f.hz}><h3>{f.hz} Hz · {f.name}</h3><p>{f.description}</p></article>)}</div><a href={MARINA_SOURCES.reactor} target="_blank" rel="noreferrer">Consultar The Harmonic Reactor · sección Numbers Hz</a></FHSurface>
        <FHSurface className="p-5 md:p-7"><h2>Pasajes para seguir explorando</h2><ul className={styles.list}><li><strong>3 Hz durante 20 minutos:</strong> preparación de campos en su libro; no especifica audífonos ni un par binaural. Puedes explorar su traducción sonora eligiendo 3 Hz, pulso y 20 minutos.</li><li><strong>Sonido del corazón:</strong> propone un valor individual y lo distingue del latido. Este módulo no mide esa variable.</li><li><strong>378394 Hz:</strong> aparece asociado a regeneración en The Scientific Download. Es ultrasonido; se conserva como referencia de estudio, no como salida de audio convencional.</li><li><strong>1.13005 Hz y un incremento de 2.7383 Hz:</strong> aparecen en su descripción de cambios de holograma; el texto no ofrece una receta de escucha.</li></ul><a href={MARINA_SOURCES.scientific} target="_blank" rel="noreferrer">Consultar The Scientific Download</a></FHSurface>
        <FHSurface className="p-5 md:p-7"><h2>Principios para llevar al día</h2><ul className={styles.list}><li><strong>Punto cero:</strong> observar antes de volver a elegir.</li><li><strong>Emoción e imagen:</strong> explorar primero el sentimiento y construir después la escena.</li><li><strong>Flexibilidad:</strong> dejar espacio a caminos que aún no habías considerado.</li><li><strong>Filantropía energética:</strong> dar algo útil por voluntad propia sin exigir devolución.</li><li><strong>Soltar y actuar:</strong> cerrar la escena y observar cómo llevas esa intención a tu vida.</li></ul><p className={styles.muted}>Estas fichas describen su propuesta. Tus experiencias e interpretaciones pueden permanecer abiertas.</p></FHSurface>
      </>}
      {(status === 'finished' || status === 'stopped') && <FHSurface className="p-5 md:p-7"><h2>Conserva tu experiencia</h2>{(['experience', 'interpretation', 'events', 'action'] as const).map(key => <label className={styles.field} key={key}>{({ experience: 'Lo que experimenté', interpretation: 'Cómo lo interpreto o qué sigue abierto', events: 'Hechos, encuentros o coincidencias posteriores', action: 'Cómo llevaré mi intención al día' })[key]}<textarea maxLength={6000} value={notes[key]} onChange={e => setNotes(n => ({ ...n, [key]: e.target.value }))} /></label>)}<div className={styles.actions}><button type="button" className="fh-action fh-action--primary" onClick={save}>Guardar sesión</button><button type="button" className="fh-action fh-action--secondary" onClick={discard}>Descartar sesión sin guardar</button></div><p className={styles.muted}>Guardado local en este navegador. No se envía al servidor ni sincroniza automáticamente con ATENEA.</p></FHSurface>}
      {tab === 'journal' && <FHSurface className="p-5 md:p-7"><div className={styles.titleRow}><h2>Mi diario · {records.length} sesiones</h2><button type="button" className="fh-action fh-action--secondary" onClick={() => { try { download(JSON.stringify(readMarinaRecords(localStorage), null, 2), 'marina-diario.json'); } catch (error) { setMessage((error as Error).message); } }}>Exportar diario</button></div>{records.length === 0 && <p className={styles.muted}>Aquí aparecerán las sesiones que decidas guardar.</p>}{[...records].reverse().map(record => <details key={record.id} className={styles.entry}><summary>{new Date(record.startedAt).toLocaleString('es-MX')} · {record.kind === 'guided' ? `Guiada · ${record.protocol === 'creation12' ? '12' : '24'} min` : 'Libre'} · {time(record.elapsedMs)} · {record.status === 'completed' ? 'Completa' : 'Detenida'}</summary><p>{record.notes.intention || 'Intención no registrada'}</p><p className={styles.muted}>{record.kind === 'guided' ? (record.protocol === 'creation12' ? 'Neutralidad → elección → imagen y sentimiento → expresión → silencio' : 'Recorrido adaptado 3 → 7 → 8 → silencio') : marinaAudioLabel(record.config)}{!record.soundEnabled ? ' · sin sonido' : ''}</p>{record.practice && <><p><strong>Frase:</strong> {record.practice.statement}</p><p><strong>Escena:</strong> {record.practice.scene}</p><p><strong>Sentimiento:</strong> {record.practice.feeling}</p></>}{Object.entries(record.notes).filter(([key, value]) => key !== 'intention' && value).map(([key, value]) => <p key={key}><strong>{({ experience: 'Experiencia', interpretation: 'Interpretación', events: 'Hechos y coincidencias', action: 'Acción' })[key as keyof Omit<MarinaNotes, 'intention'>]}:</strong> {value}</p>)}{record.followUps?.map(item => <p key={item.id}><strong>{new Date(item.at).toLocaleString('es-MX')}:</strong> {item.text}</p>)}<label className={styles.field}>Añadir un hecho posterior<textarea value={followUpDrafts[record.id] ?? ''} maxLength={6000} onChange={e => setFollowUpDrafts(d => ({ ...d, [record.id]: e.target.value }))} /></label><button type="button" className="fh-action fh-action--secondary" disabled={!followUpDrafts[record.id]?.trim()} onClick={() => {
        try {
          setRecords(addMarinaFollowUp(localStorage, record.id, { id: crypto.randomUUID(), at: new Date().toISOString(), text: followUpDrafts[record.id].trim() }));
          setFollowUpDrafts(d => ({ ...d, [record.id]: '' })); setMessage('Observación posterior guardada con fecha.');
        } catch (error) { setMessage((error as Error).message); }
      }}>Guardar observación con fecha</button></details>)}</FHSurface>}
      {storageError && <button type="button" className="fh-action fh-action--secondary" onClick={() => download(localStorage.getItem(MARINA_STORAGE_KEY) ?? '', 'marina-diario-original.json')}>Exportar el diario original</button>}
      {message && <p role="status" className={styles.message}>{message}</p>}
    </div>
  </FHPageShell>;
}
