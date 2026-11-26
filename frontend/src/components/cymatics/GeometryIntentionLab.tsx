'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FHPageHeader, FHPageShell, FHSurface } from '@/components/ui/FHLayout';
import { getAudioEngine } from '@/lib/audioEngine';
import { MarinaComposerAudio } from '@/lib/marina/composerAudio';
import { MarinaClock } from '@/lib/marina/model';
import { useMarinaMediaSession } from '@/components/marina/useMarinaMediaSession';
import { FIGURES, INTERVALS, GEOMETRY_SOURCES, GEOMETRY_VERSION, PRACTICE_PHASES, defaultGeometry, geometryNow, geometryRecipe, geometryTones, practicePhaseAt, validateGeometry, validatePhaseMinutes, type GeometryConfig } from '@/lib/cymatics/geometry';
import { GEOMETRY_JOURNAL_KEY, addGeometryFollowUp, importGeometryJournal, readGeometryJournal, saveGeometryRecord, validateEmotion, validateGeometryRecord, type Emotion, type GeometryRecord } from '@/lib/cymatics/geometryJournal';
import GeometryView from './GeometryView';
import styles from './geometry.module.css';

type Status = 'idle' | 'starting-preview' | 'preview' | 'starting' | 'playing' | 'paused' | 'finished';
const neutral = (): Emotion => ({ valence: 0, activation: 5, clarity: 5 });
const time = (ms: number) => `${Math.floor(ms/60000).toString().padStart(2,'0')}:${Math.floor(ms/1000%60).toString().padStart(2,'0')}`;
function download(content: string, filename: string) {
  const url=URL.createObjectURL(new Blob([content],{type:'application/json'})),a=document.createElement('a');
  a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function initialJournal() {
  try { return { rows: typeof localStorage==='undefined'?[]:readGeometryJournal(localStorage), error: '' }; }
  catch(error) { return {rows:[],error:(error as Error).message}; }
}
export default function GeometryIntentionLab({navigation}:{navigation:ReactNode}) {
  const [config,setConfig]=useState(defaultGeometry),[minutes,setMinutes]=useState<[number,number,number,number]>([2,2,4,2]);
  const [before,setBefore]=useState(neutral),[intention,setIntention]=useState(''),[thought,setThought]=useState('');
  const [sound,setSound]=useState(false),[volume,setVolume]=useState(.12),[status,setStatus]=useState<Status>('idle'),[elapsed,setElapsed]=useState(0);
  const [initial]=useState(initialJournal),[rows,setRows]=useState<GeometryRecord[]>(initial.rows),[message,setMessage]=useState(initial.error);
  const [draft,setDraft]=useState<GeometryRecord|null>(null),[busy,setBusy]=useState(false),[followUps,setFollowUps]=useState<Record<string,string>>({});
  const engine=useRef<MarinaComposerAudio|null>(null),clock=useRef<MarinaClock|null>(null),snapshot=useRef<GeometryRecord|null>(null),operation=useRef(0),writing=useRef(false),interruption=useRef<()=>void>(()=>{});
  const active=['starting','playing','paused'].includes(status),preview=['preview','starting-preview'].includes(status),locked=active||status==='finished';
  let error='',tones:number[]=[],phaseMinutes=minutes;
  try { validateGeometry(config);tones=geometryTones(config);phaseMinutes=validatePhaseMinutes(minutes); } catch(e) { error=(e as Error).message; }
  const duration=phaseMinutes.reduce((a,b)=>a+b,0)*60000,phase=practicePhaseAt(phaseMinutes,elapsed),figure=FIGURES.find(f=>f.id===config.figure)!;
  const ratio=INTERVALS.find(i=>i.id===config.interval)!;
  const readElapsed=()=>snapshot.current?.soundEnabled?engine.current?.elapsedMs()??0:clock.current?.tick(geometryNow())??0;
  function audio() {
    engine.current??=new MarinaComposerAudio(undefined,()=>getAudioEngine().stop(),()=>interruption.current());
    return engine.current;
  }
  function stopPreview() {operation.current++;engine.current?.stop();setStatus('idle');setElapsed(0);}
  function pause() {
    operation.current++;
    if(preview){stopPreview();return;}
    const value=readElapsed();engine.current?.stop();clock.current?.pause();
    if(clock.current)clock.current.elapsedMs=value;
    setElapsed(value);setStatus('paused');
  }
  useEffect(()=>{interruption.current=()=>{pause();setMessage('El dispositivo interrumpió el sonido. Puedes reanudar la práctica.');};});
  useEffect(()=>()=>{operation.current++;engine.current?.dispose();},[]);
  function finish(completed=false) {
    operation.current++;
    const session=snapshot.current;if(!session)return;
    const value=completed?session.phaseMinutes.reduce((a,b)=>a+b,0)*60000:Math.min(duration,readElapsed());
    engine.current?.stop();clock.current?.pause();
    const endedAt=new Date().toISOString();
    setElapsed(value);setDraft({...structuredClone(session),endedAt,status:completed?'completed':'stopped',elapsedMs:Math.round(value),after:{...session.before}});setStatus('finished');
  }
  useEffect(()=>{
    if(status!=='playing'&&status!=='preview')return;
    const timer=setInterval(()=>{
      if(status==='preview'){const value=engine.current?.elapsedMs()??0;setElapsed(value);if(value>=60000)stopPreview();return;}
      const value=readElapsed();setElapsed(value);if(value>=duration)finish(true);
    },200);
    return()=>clearInterval(timer);
  });
  useEffect(()=>{
    const update=(event:StorageEvent)=>{if(event.key!==GEOMETRY_JOURNAL_KEY)return;try{setRows(readGeometryJournal(localStorage));}catch(e){setMessage((e as Error).message);}};
    window.addEventListener('storage',update);return()=>window.removeEventListener('storage',update);
  },[]);
  async function startPreview(next=config) {
    const ticket=++operation.current;setStatus('starting-preview');setMessage('');
    try {const started=await audio().play(geometryRecipe(next),volume);if(ticket===operation.current&&started)setStatus('preview');}
    catch(e){if(ticket===operation.current){setStatus('idle');setMessage((e as Error).message);}}
  }
  function patch(value:Partial<GeometryConfig>) {
    const next={...config,...value};setConfig(next);
    if(preview&&('baseHz'in value||'interval'in value)){
      try{validateGeometry(next);void startPreview(next);}catch(e){stopPreview();setMessage((e as Error).message);}
    }
  }
  async function start(resume=false) {
    const ticket=++operation.current;
    try {
      if(!resume){
        const current=validateGeometry(config),times=validatePhaseMinutes(minutes),now=new Date().toISOString();validateEmotion(before);
        snapshot.current=validateGeometryRecord({version:GEOMETRY_VERSION,id:crypto.randomUUID(),startedAt:now,endedAt:now,status:'stopped',elapsedMs:0,config:current,phaseMinutes:times,soundEnabled:sound,volume,volumeChanges:[],before,after:before,intention,thought,decision:'',action:'',observation:'',followUps:[]});
        clock.current=new MarinaClock(times.reduce((a,b)=>a+b,0)*60000);setElapsed(0);
      }
      const session=snapshot.current;if(!session||!clock.current)return;
      setStatus('starting');setMessage('');
      if(session.soundEnabled){const started=await audio().play(geometryRecipe(session.config,session.phaseMinutes.reduce((a,b)=>a+b,0)),volume,clock.current.elapsedMs);if(!started||ticket!==operation.current)return;}
      else clock.current.resume();
      if(ticket===operation.current)setStatus('playing');
    }catch(e){if(ticket===operation.current){engine.current?.stop();setStatus(snapshot.current?'paused':'idle');setMessage((e as Error).message);}}
  }
  function changeVolume(next:number) {
    if(snapshot.current&&active)snapshot.current.volumeChanges.push({elapsedMs:Math.round(readElapsed()),volume:next});
    engine.current?.setVolume(next);setVolume(next);
  }
  async function save() {
    if(!draft||writing.current)return;writing.current=true;setBusy(true);
    try{setRows(await saveGeometryRecord(draft,localStorage));setDraft(null);snapshot.current=null;setStatus('idle');setElapsed(0);setMessage('Práctica guardada en el diario de este navegador.');}
    catch(e){setMessage((e as Error).message);}finally{writing.current=false;setBusy(false);}
  }
  function reset() {snapshot.current=null;clock.current=null;setDraft(null);setStatus('idle');setElapsed(0);}
  useMarinaMediaSession('Geometría e intención',preview?60000:duration,elapsed,active||preview,status==='playing'||status==='preview',{
    play:()=>{if(status==='paused')void start(true);},pause:()=>{if(active||preview)pause();},stop:()=>{if(preview)stopPreview();else finish();},
  });
  const updateDraft=(value:Partial<GeometryRecord>)=>setDraft(current=>current?{...current,...value}:null);
  return <FHPageShell width="wide" className={styles.lab}>
    <FHPageHeader eyebrow="ESTUDIO · SONIDO · EXPERIENCIA" title="Geometría e intención" description="Explora proporciones musicales, construcciones geométricas y un ciclo de práctica que puedes adaptar."/>{navigation}
    <div className={styles.layout}>
      <FHSurface className={styles.visual}>
        <div className={styles.heading}><div><p className={styles.kicker}>{figure.kind}</p><h2>{figure.name}</h2></div><a href="#fuentes-geometria">Ver fundamento y fuentes</a></div>
        <GeometryView config={config}/>
        <div className={styles.controls}>
          <label>Visualización<select aria-label="Visualización geométrica" disabled={locked} value={config.figure} onChange={e=>patch({figure:e.target.value as GeometryConfig['figure']})}>{FIGURES.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
          {['lissajous','russell'].includes(config.figure)&&<label>Fase · {config.phaseDegrees}°<input aria-label="Fase geométrica" disabled={locked} type="range" min="0" max="360" step="1" value={config.phaseDegrees} onChange={e=>patch({phaseDegrees:Number(e.target.value)})}/></label>}
          {config.figure!=='lissajous'&&<label>Giro · {config.rotationDegrees}°<input aria-label="Giro geométrico" disabled={locked} type="range" min="0" max="360" step="1" value={config.rotationDegrees} onChange={e=>patch({rotationDegrees:Number(e.target.value)})}/></label>}
          {config.figure==='flower'&&<label>Capas de círculos<select aria-label="Capas de círculos" disabled={locked} value={config.flowerRings} onChange={e=>patch({flowerRings:Number(e.target.value)})}>{[1,2,3].map(n=><option key={n} value={n}>{n} · {1+3*n*(n+1)} círculos</option>)}</select></label>}
          {config.figure==='pentagons'&&<><label>Apertura · {config.openingDegrees}°<input aria-label="Apertura pentangular" disabled={locked} type="range" min="0" max="80" step="1" value={config.openingDegrees} onChange={e=>patch({openingDegrees:Number(e.target.value)})}/></label><label>Copias<select aria-label="Copias pentangulares" disabled={locked} value={config.copies} onChange={e=>patch({copies:Number(e.target.value)})}>{[1,2,3].map(n=><option key={n}>{n}</option>)}</select></label></>}
        </div>
        {['lissajous','russell'].includes(config.figure)&&<label className={styles.check}><input disabled={locked} type="checkbox" checked={config.animate} onChange={e=>patch({animate:e.target.checked})}/> Animar el recorrido visual</label>}
        <p className={styles.note}>El intervalo determina la relación de Lissajous. Las otras vistas son construcciones que puedes ajustar; no se convierten en figuras físicas de una placa al cambiar el tono. <a href="#fuente-chladni">Fuente sobre placas</a>.</p>
      </FHSurface>
      <FHSurface className={styles.sound}>
        <p className={styles.kicker}>AFINACIÓN JUSTA</p><h2>Escuchar proporciones</h2>
        <p>La base es editable. Las relaciones son musicales; el número de lados de una figura no fija su frecuencia.</p>
        <div className={styles.fields}>
          <label>Base (Hz)<input aria-label="Base musical (Hz)" disabled={locked||status==='starting-preview'} type="number" min="40" max="1000" step="any" value={config.baseHz} onChange={e=>patch({baseHz:Number(e.target.value)})}/></label>
          <label>Intervalo<select aria-label="Intervalo musical" disabled={locked||status==='starting-preview'} value={config.interval} onChange={e=>patch({interval:e.target.value as GeometryConfig['interval']})}>{INTERVALS.map(i=><option key={i.id} value={i.id}>{i.name} · {i.numerator}:{i.denominator}</option>)}</select></label>
          <output aria-label="Frecuencias del intervalo">{tones.map(t=>`${t.toLocaleString('es-MX',{maximumFractionDigits:6})} Hz`).join(' + ')||'Revisa la frecuencia'} · razón {ratio.numerator}:{ratio.denominator}</output>
          <label>Volumen · {Math.round(volume*100)} %<input aria-label="Volumen de geometría" type="range" min="0" max=".6" step=".01" value={volume} onChange={e=>changeVolume(Number(e.target.value))}/></label>
        </div>
        <div className={styles.actions}>{preview?<button type="button" onClick={stopPreview}>Detener intervalo</button>:<button type="button" disabled={locked||!!error} onClick={()=>void startPreview()}>Escuchar intervalo</button>}</div>
        <p className={styles.note}>Escucha de hasta 60 segundos. Puedes cambiar base e intervalo mientras suena. Los dos tonos se mezclan en ambos canales; no es un ritmo binaural. <a href="#fuente-construction">Cálculo</a>.</p>
        <table><caption>Frecuencias con tu base</caption><thead><tr><th>Relación</th><th>Hz</th></tr></thead><tbody>{INTERVALS.map(i=><tr key={i.id}><td>{i.name} · {i.numerator}:{i.denominator}</td><td>{Number.isFinite(config.baseHz)?(config.baseHz*i.numerator/i.denominator).toLocaleString('es-MX',{maximumFractionDigits:6}):'—'}</td></tr>)}</tbody></table>
      </FHSurface>
    </div>
    <FHSurface className={styles.practice}>
      <p className={styles.kicker}>MI RECORRIDO · {minutes.reduce((a,b)=>a+b,0)} MINUTOS</p><h2>Recoger → formular → representar → soltar</h2>
      <p>Adaptación propia para explorar atención, emoción e imagen. Ajusta cada tramo y registra lo que te resulte útil. <a href="#fuente-russell">Russell</a> · <a href="#fuente-emotion">Nombrar emociones</a> · <a href="#fuente-breathing">Respiración</a>.</p>
      <div className={styles.phaseInputs}>{PRACTICE_PHASES.map((p,i)=><label key={p.name}>{p.name}<input aria-label={`Minutos: ${p.name}`} type="number" disabled={locked||preview} min="1" max="15" step="1" value={minutes[i]} onChange={e=>setMinutes(current=>current.map((v,j)=>j===i?Number(e.target.value):v) as typeof minutes)}/>min</label>)}</div>
      <div className={styles.fields}><label>Mi intención<textarea aria-label="Intención de la práctica" disabled={locked||preview} maxLength={4000} value={intention} onChange={e=>setIntention(e.target.value)} placeholder="Una dirección concreta que quiero explorar"/></label><label>Pensamiento o contexto<textarea aria-label="Pensamiento o contexto" disabled={locked||preview} maxLength={4000} value={thought} onChange={e=>setThought(e.target.value)} placeholder="Qué está presente en mí antes de comenzar"/></label></div>
      <EmotionFields label="Antes" value={before} disabled={locked||preview} onChange={setBefore}/>
      <label className={styles.check}><input type="checkbox" disabled={locked||preview} checked={sound} onChange={e=>setSound(e.target.checked)}/> Acompañar toda la práctica con el intervalo elegido</label>
      {active&&<div className={styles.player}><p aria-label="Tiempo restante de geometría">{time(Math.max(0,duration-elapsed))}</p><progress aria-label="Avance del recorrido geométrico" max={duration} value={elapsed}/><h3>{PRACTICE_PHASES[Math.max(0,phase)]?.name}</h3><p>{PRACTICE_PHASES[Math.max(0,phase)]?.guide}</p></div>}
      <div className={styles.actions}>{status==='idle'&&<button type="button" disabled={preview||!!error} onClick={()=>void start()}>Comenzar mi recorrido</button>}{status==='starting'&&<span role="status">Preparando práctica…</span>}{status==='playing'&&<button type="button" onClick={pause}>Pausar práctica</button>}{status==='paused'&&<button type="button" onClick={()=>void start(true)}>Reanudar práctica</button>}{active&&<button type="button" onClick={()=>finish()}>Terminar y registrar</button>}</div>
      <p className={styles.note}>Agrado, activación y claridad son dimensiones distintas. Una emoción incómoda puede aportar información; registra lo que ocurre sin clasificarte como alineado o desalineado.</p>
    </FHSurface>
    {draft&&<FHSurface className={styles.review}><h2>Registrar mi experiencia</h2><p>{draft.status==='completed'?'Recorrido completado':'Tramo realizado'} · {time(draft.elapsedMs)}. Distingue lo observado de tu interpretación.</p><EmotionFields label="Después" value={draft.after} onChange={value=>updateDraft({after:value})}/><div className={styles.fields}>{(['observation','decision','action'] as const).map(key=><label key={key}>{({observation:'Lo que observé y mi interpretación',decision:'Decisión que elijo revisar o tomar',action:'Mi siguiente acción'})[key]}<textarea aria-label={key==='action'?'Mi siguiente acción':key==='decision'?'Mi decisión':'Mi observación'} maxLength={4000} value={draft[key]} onChange={e=>updateDraft({[key]:e.target.value})}/></label>)}</div><div className={styles.actions}><button type="button" disabled={busy} onClick={()=>void save()}>Guardar práctica en el diario</button><button type="button" onClick={()=>download(JSON.stringify([draft],null,2),'resonance-lab-geometria-borrador.json')}>Exportar borrador</button><button type="button" disabled={busy} onClick={reset}>Descartar borrador y volver</button></div></FHSurface>}
    {(error||message)&&<p className={styles.message} role="status">{error||message}</p>}
    <FHSurface className={styles.journal}><h2 id="diario-geometrico">Diario de geometría y emoción · {rows.length} registros</h2><p>Guarda emociones, pensamientos, decisiones y observaciones posteriores. Se conserva en este navegador; exporta e importa el diario para llevarlo a otro dispositivo.</p><div className={styles.actions}><button type="button" onClick={()=>{try{download(localStorage.getItem(GEOMETRY_JOURNAL_KEY)??'[]','resonance-lab-geometria-diario.json');}catch(e){setMessage((e as Error).message);}}}>Exportar diario geométrico</button><label className={styles.file}>Importar diario<input aria-label="Importar diario geométrico" disabled={active||preview||busy} type="file" accept=".json,application/json" onChange={async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;if(f.size>5_000_000){setMessage('El archivo supera 5 MB.');return;}try{setRows(await importGeometryJournal(await f.text(),localStorage));setMessage('Diario importado. Los registros existentes se conservaron.');}catch(err){setMessage((err as Error).message);}}}/></label></div>{[...rows].reverse().map(row=><details key={row.id}><summary>{new Date(row.startedAt).toLocaleString('es-MX')} · {FIGURES.find(f=>f.id===row.config.figure)?.name} · {time(row.elapsedMs)}</summary><p><strong>Intención:</strong> {row.intention||'Sin texto'}</p><p><strong>Pensamiento:</strong> {row.thought||'Sin texto'}</p><p>Antes: agrado {row.before.valence}, activación {row.before.activation}, claridad {row.before.clarity}. Después: agrado {row.after.valence}, activación {row.after.activation}, claridad {row.after.clarity}.</p><p><strong>Observación:</strong> {row.observation||'Sin texto'}</p><p><strong>Decisión:</strong> {row.decision||'Sin texto'}</p><p><strong>Acción:</strong> {row.action||'Sin texto'}</p><p>{geometryTones(row.config).map(hz=>hz.toLocaleString('es-MX',{maximumFractionDigits:6})).join(' + ')} Hz · {row.soundEnabled?'con sonido':'sin sonido'} · volumen inicial {Math.round(row.volume*100)} % · {row.volumeChanges.length} cambios de volumen.</p><ul>{row.followUps.map((f,i)=><li key={i}>{new Date(f.at).toLocaleString('es-MX')} · {f.text}</li>)}</ul><label>Observación posterior<textarea aria-label={`Observación posterior ${row.id}`} maxLength={4000} value={followUps[row.id]??''} onChange={e=>setFollowUps(current=>({...current,[row.id]:e.target.value}))}/></label><button type="button" disabled={busy||!(followUps[row.id]??'').trim()} onClick={async()=>{try{setRows(await addGeometryFollowUp(row.id,{at:new Date().toISOString(),text:followUps[row.id].trim()},localStorage));setFollowUps(current=>({...current,[row.id]:''}));setMessage('Observación posterior guardada con fecha.');}catch(e){setMessage((e as Error).message);}}}>Guardar observación posterior</button></details>)}</FHSurface>
    <section id="fuentes-geometria"><FHSurface className={styles.sources}><h2>Fundamento y fuentes por afirmación</h2><p>Consulta qué sostiene cada referencia y cómo se utiliza aquí. Las prácticas, el trazado y el ensamblaje ajustable son elaboraciones propias.</p>{GEOMETRY_SOURCES.map(source=><details key={source.id} id={`fuente-${source.id}`}><summary>{source.title} · {source.kind}</summary><p>{source.locator}</p><p><strong>Qué aporta:</strong> {source.claim}</p><p><strong>Alcance:</strong> {source.limit}</p>{source.url&&<a href={source.url} target="_blank" rel="noopener noreferrer">Abrir fuente original: {source.title}</a>}</details>)}</FHSurface></section>
  </FHPageShell>;
}
function EmotionFields({label,value,disabled=false,onChange}:{label:string;value:Emotion;disabled?:boolean;onChange:(value:Emotion)=>void}) {
  return <fieldset className={styles.emotion} disabled={disabled}><legend>{label} · mi estado</legend>{(['valence','activation','clarity'] as const).map(key=><label key={key}>{({valence:'Agrado',activation:'Activación',clarity:'Claridad'})[key]} · {value[key]}<input aria-label={`${label}: ${({valence:'agrado',activation:'activación',clarity:'claridad'})[key]}`} type="range" min={key==='valence'?-5:0} max={key==='valence'?5:10} step="1" value={value[key]} onChange={e=>onChange({...value,[key]:Number(e.target.value)})}/></label>)}</fieldset>;
}
