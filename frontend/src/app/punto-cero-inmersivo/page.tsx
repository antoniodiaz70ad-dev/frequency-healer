'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {CymaticsPalette} from '@/lib/cymatics/palettes';
import CymaticsCanvas from '@/components/cymatics/CymaticsCanvas';
import {computeModalField,defaultCymaticsConfig,squarePlateFrequencyHz} from '@/lib/cymatics/physics';
import phases from './phases.json';
import styles from './session.module.css';

export default function ImmersiveSession(){
  const [phase,setPhase]=useState(-1),[message,setMessage]=useState('');
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
  const config=useMemo(()=>{
    const c=defaultCymaticsConfig();
    // Scale the same plate for both tones; tune its (2,4) family to the base tone.
    const side=c.dimensionsSI.widthM*Math.sqrt(squarePlateFrequencyHz(2,4,c)/phases[0].hz);
    c.dimensionsSI.widthM=side;c.dimensionsSI.heightM=side;
    c.excitationPosition={x:.21,y:.32};c.modeCutoff=7;c.view='particles';c.autoExposure=true;
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
    <audio ref={audio} src="/punto-cero-tonos-v2.wav" preload="metadata" playsInline onTimeUpdate={sync}
      onError={()=>{if(mode.current)finish('No se pudo cargar el audio. Comprueba tu conexión y vuelve a intentarlo.');}}
      onPause={()=>{if(mode.current && audio.current?.paused && !audio.current.ended)finish('Audio interrumpido. Puedes volver a comenzar.');}}
      onEnded={()=>finish('Sesión completa. Haz ahora el primer paso que elegiste.')}/>
    {phase<0?<><h1>Punto Cero inmersivo</h1><p>5 minutos · Audífonos · Cuatro etapas automáticas</p>
      <p>Coloca la pantalla a una distancia cómoda. Puedes escuchar el tono de inicio y ajustar el volumen antes de comenzar.</p>
      <button onClick={()=>void start('preview')}>Comprobar sonido</button>{' '}
      <button onClick={()=>void start('session')}>Comenzar sesión inmersiva</button><p role="status">{message}</p><a href="/marina-punto-cero/compositor">Volver al compositor</a></>:
      <><div className={styles.figure}><CymaticsCanvas config={config} field={field} label="Placa simulada" showContours/></div>
      <section aria-live="polite" className={styles.caption}><h1>{current.name}</h1><p>{current.cue}</p></section>
      <button className={styles.stop} onClick={()=>finish('Sesión detenida.')}>Salir</button></>}
  </div>;
}
