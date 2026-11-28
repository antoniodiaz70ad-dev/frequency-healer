'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import CymaticsCanvas from '@/components/cymatics/CymaticsCanvas';
import {computeModalField,defaultCymaticsConfig} from '@/lib/cymatics/physics';
import type {CymaticsPalette} from '@/lib/cymatics/palettes';
import styles from './session.module.css';

const phases = [
  {end:60, name:'Intención', hz:136.1, color:'teal', cue:'Elige una acción concreta para hoy.'},
  {end:180, name:'Sonido y forma', hz:136.1, color:'teal', cue:'Sigue la figura. Si quieres, tararea suavemente.'},
  {end:240, name:'Visualización', hz:204.15, color:'amber', cue:'Imagina el primer paso y cómo superarías el obstáculo.'},
  {end:300, name:'Acción', hz:136.1, color:'red', cue:'Cuando termine el sonido, empieza ese primer paso.'},
] as const satisfies readonly {end:number;name:string;hz:number;color:CymaticsPalette;cue:string}[];

export default function ImmersiveSession(){
  const [phase,setPhase]=useState(-1),[message,setMessage]=useState('');
  const stage=useRef<HTMLDivElement>(null), audio=useRef<AudioContext|null>(null), lock=useRef<WakeLockSentinel|null>(null);
  const release=useCallback(()=>{
    const context=audio.current;audio.current=null;
    if(context && context.state!=='closed')void context.close().catch(()=>{});
    if(lock.current)void lock.current.release().catch(()=>{});
    lock.current=null;
    if(document.fullscreenElement===stage.current && document.fullscreenElement)void document.exitFullscreen().catch(()=>{});
  },[]);
  const finish=useCallback((note:string)=>{release();setPhase(-1);setMessage(note);},[release]);
  useEffect(()=>{
    const hidden=()=>{if(document.hidden && audio.current)finish('Sesión detenida al salir de la pantalla.');};
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape' && audio.current)finish('Sesión detenida.');};
    document.addEventListener('visibilitychange',hidden);window.addEventListener('keydown',escape);
    return ()=>{document.removeEventListener('visibilitychange',hidden);window.removeEventListener('keydown',escape);release();};
  },[finish,release]);
  const current=phases[Math.max(0,phase)];
  const config=useMemo(()=>({...defaultCymaticsConfig(),view:'field' as const,autoExposure:true,palette:current.color,channelFrequenciesHz:[current.hz],modeledComponents:[current.hz]}),[current]);
  const field=useMemo(()=>computeModalField(config,current.hz),[config,current]);
  async function start(){
    if(audio.current)return;
    let context:AudioContext|undefined;
    try{
      context=new AudioContext();audio.current=context;
      const resumed=context.resume();
      void stage.current?.requestFullscreen?.().catch(()=>{});
      const owner=context;
      void navigator.wakeLock?.request('screen').then(s=>{if(audio.current===owner)lock.current=s;else void s.release();}).catch(()=>{});
      setMessage('');setPhase(0);await resumed;
      if(audio.current!==context)return;
      const origin=context.currentTime+.08;
      let from=0;
      for(const [index,p] of phases.entries()){
        const osc=context.createOscillator(),gain=context.createGain();
        const begin=origin+from,end=origin+p.end;
        osc.frequency.value=p.hz;gain.gain.setValueAtTime(0,begin);gain.gain.linearRampToValueAtTime(.055,begin+1);
        gain.gain.setValueAtTime(.055,end-1);gain.gain.linearRampToValueAtTime(0,end);
        osc.connect(gain);gain.connect(context.destination);
        osc.onended=()=>{osc.disconnect();gain.disconnect();if(audio.current!==owner)return;
          if(index===phases.length-1)finish('Sesión completa. Haz ahora el primer paso que elegiste.');
          else setPhase(index+1);
        };
        osc.start(begin);osc.stop(end);from=p.end;
      }
    }catch{if(!context||audio.current===context)finish('No se pudo iniciar el audio. Vuelve a intentarlo.');}
  }
  return <div ref={stage} className={phase>=0?styles.active:styles.intro}>
    {phase<0?<><h1>Punto Cero inmersivo</h1><p>5 minutos · Audífonos · Cuatro etapas automáticas</p><p>Coloca el teléfono en un soporte a una distancia cómoda. Ajusta el volumen antes de comenzar.</p>
      <button onClick={()=>void start()}>Comenzar sesión inmersiva</button><p role="status">{message}</p><a href="/marina-punto-cero/compositor">Volver al compositor</a></>:
      <><div className={styles.figure}><CymaticsCanvas config={config} field={field} label={current.name} animateVibration={false}/></div>
      <section aria-live="polite" className={styles.caption}><h1>{current.name}</h1><p>{current.cue}</p></section>
      <button className={styles.stop} onClick={()=>finish('Sesión detenida.')}>Salir</button></>}
  </div>;
}
