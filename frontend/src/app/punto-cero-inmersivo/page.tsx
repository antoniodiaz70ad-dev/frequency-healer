'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {paletteNames,palettes,type CymaticsPalette} from '@/lib/cymatics/palettes';
import CymaticsCanvas from '@/components/cymatics/CymaticsCanvas';
import {computeModalField,defaultCymaticsConfig} from '@/lib/cymatics/physics';
import stages from './phases.json';
import recipes from './recipes.json';
import styles from './session.module.css';

export default function ImmersiveSession(){
  const [phase,setPhase]=useState(-1),[message,setMessage]=useState('');
  const [recipe,setRecipe]=useState(recipes[0]);
  const phases=useMemo(()=>stages.map((stage,index)=>({...stage,hz:recipe.tones[index]})),[recipe]);
  const stage=useRef<HTMLDivElement>(null), audio=useRef<HTMLAudioElement>(null);
  const mode=useRef<'session'|'preview'|null>(null), ticket=useRef(0), lock=useRef<WakeLockSentinel|null>(null);
  const release=useCallback(()=>{
    ticket.current++;
    mode.current=null;
    audio.current?.pause();
    if(lock.current)void lock.current.release().catch(()=>{});
    lock.current=null;
    if(document.fullscreenElement && document.fullscreenElement===stage.current)void document.exitFullscreen().catch(()=>{});
  },[]);
  const finish=useCallback((note:string)=>{release();setPhase(-1);setMessage(note);},[release]);
  useEffect(()=>{
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape' && mode.current)finish('Sesión detenida.');};
    window.addEventListener('keydown',escape);
    return ()=>{window.removeEventListener('keydown',escape);release();};
  },[finish,release]);
  const current=phases[Math.max(0,phase)];
  const palette=current.color as CymaticsPalette;
  const config=useMemo(()=>{
    const c=defaultCymaticsConfig();
    c.surfaceType='circular-membrane';
    c.boundaryCondition='fixed-edge';
    c.view='particles';c.autoExposure=true;
    c.palette=current.color as CymaticsPalette;c.channelFrequenciesHz=[current.hz];c.modeledComponents=[current.hz];
    return c;
  },[current]);
  const field=useMemo(()=>computeModalField(config,current.hz),[config,current.hz]);
  async function start(kind:'session'|'preview'){
    const player=audio.current;
    if(!player || mode.current==='session')return;
    release();
    const id=ticket.current;
    mode.current=kind;
    setMessage('Cargando audio…');
    try{
      const session=(navigator as Navigator & {audioSession?:{type:string}}).audioSession;
      if(session)session.type='playback';
      player.currentTime=0;
      const playing=player.play();
      if(kind==='session')void stage.current?.requestFullscreen?.().catch(()=>{});
      await playing;
      if(ticket.current!==id)return;
      if(kind==='preview'){setMessage('Prueba de sonido de tres segundos.');return;}
      setPhase(0);setMessage('');
      void navigator.wakeLock?.request('screen').then(s=>{if(ticket.current===id)lock.current=s;else void s.release();}).catch(()=>{});
    }catch{if(ticket.current===id)finish('El audio no pudo reproducirse. Toca Comprobar sonido para reintentar.');}
  }
  function sync(){
    const player=audio.current;
    if(!player || player.paused)return;
    if(mode.current==='preview' && player.currentTime>=3)finish('Prueba terminada. Puedes comenzar la sesión.');
    if(mode.current==='session'){
      const index=phases.findIndex(p=>player.currentTime<p.end);
      if(index>=0)setPhase(index);
    }
  }
  return <div ref={stage} className={phase>=0?styles.active:styles.intro}>
    <audio key={recipe.audio} ref={audio} src={'/'+recipe.audio} preload="metadata" playsInline onTimeUpdate={sync}
      onError={()=>{if(mode.current)finish('No se pudo cargar el audio. Comprueba tu conexión y vuelve a intentarlo.');}}
      onPause={()=>{if(mode.current && audio.current?.paused && !audio.current.ended)finish('Audio interrumpido. Puedes volver a comenzar.');}}
      onEnded={()=>finish('Sesión completa. Haz ahora el primer paso que elegiste.')}/>
    {phase<0?<><h1>Punto Cero inmersivo</h1><p>4 minutos · Audífonos · Un minuto por etapa</p>
      <fieldset className={styles.recipes}><legend>Elige tu receta</legend>
        {recipes.map(option=><label key={option.name}>
          <input type="radio" name="receta" checked={recipe===option} onChange={()=>{release();setMessage('');setRecipe(option);}}/>
          {option.name}
        </label>)}
      </fieldset>
      <ol className={styles.tones} aria-label="Secuencia por minuto">{phases.map((step,index)=><li key={step.end}>
        <i aria-hidden="true" style={{backgroundColor:palettes[step.color as CymaticsPalette].field}}/>
        <span>Min {index+1} · {paletteNames[step.color as CymaticsPalette]}</span><strong>{step.hz.toFixed(2)} Hz</strong>
      </li>)}</ol>
      <p>Coloca la pantalla a una distancia cómoda. Puedes escuchar el tono de inicio y ajustar el volumen antes de comenzar.</p>
      <button onClick={()=>void start('preview')}>Comprobar sonido</button>{' '}
      <button onClick={()=>void start('session')}>Comenzar sesión inmersiva</button><p role="status">{message}</p><a href="/marina-punto-cero/compositor">Volver al compositor</a></>:
      <><div className={styles.figure}><CymaticsCanvas resetToken={current.hz} config={config} field={field} label="Membrana circular de borde fijo" immersive/></div>
      <section aria-live="polite" className={styles.caption}><strong className={styles.reading} style={{color:palettes[palette].field}}>{current.hz.toFixed(2)} Hz · {paletteNames[palette]}</strong><h1>{current.name}</h1><p>{current.cue}</p></section>
      <button className={styles.stop} onClick={()=>finish('Sesión detenida.')}>Salir</button></>}
  </div>;
}
