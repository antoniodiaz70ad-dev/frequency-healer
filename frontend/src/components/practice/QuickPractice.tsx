'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import SessionDownload from '../sessionExport/SessionDownload';
import { composerScore } from '@/lib/sessionExport/score';
import {guideCues} from '@/lib/narration/arthur';
import {MARINA_PHASES} from '@/lib/marina/model';
import QuickRecordsPanel from './QuickRecordsPanel';
import type {QuickSession} from '@/lib/marina/quickRecords';
import { starterCompositions, layerLabel, type ComposerRecipe } from '@/lib/marina/composer';
import { MarinaComposerAudio } from '@/lib/marina/composerAudio';
import { getAudioEngine } from '@/lib/audioEngine';

type State = 'idle' | 'starting' | 'preview' | 'playing' | 'paused' | 'finished' | 'voice';
const clock = (ms:number) => `${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;
export default function QuickPractice(){
 const [choice,setChoice]=useState('focus'),[minutes,setMinutes]=useState(10),[volume,setVolume]=useState(.15);
 const [state,setState]=useState<State>('idle'),[elapsed,setElapsed]=useState(0),[message,setMessage]=useState('');
 const engine=useRef<MarinaComposerAudio|null>(null),ticket=useRef(0);
 const [mode,setMode]=useState<'preview'|'practice'>('practice');
 const [loaded,setLoaded]=useState<ComposerRecipe|null>(null),[versionId,setVersionId]=useState<string|undefined>(),[draft,setDraft]=useState<QuickSession|null>(null);
 const run=useRef<QuickSession|null>(null);
 const voiceAudio=useRef<HTMLAudioElement|null>(null);
 const busy=state==='voice'||state==='starting'||state==='preview'||state==='playing'||state==='paused';
 const recipe:ComposerRecipe=loaded?structuredClone(loaded):starterCompositions()[choice==='focus'?2:0]; recipe.durationMinutes=minutes;
 const total=state==='preview'?15000:minutes*60000;
 useEffect(()=>{const audio=voiceAudio.current;return ()=>{ticket.current++;audio?.pause();engine.current?.dispose();};},[]);
 useEffect(()=>{
  if(state!=='playing'&&state!=='preview')return;
  const timer=setInterval(()=>{const now=engine.current?.elapsedMs()??0;setElapsed(now);if(now>=total){if(mode==='practice')finishRecord('completed',total);engine.current?.stop();setState(mode==='preview'?'idle':'finished');setMessage(mode==='preview'?'Muestra terminada. Puedes comenzar desde el inicio.':'Práctica terminada. No se ha guardado un registro.');}},100);
  return ()=>clearInterval(timer);
 },[state,total,mode]);
 function finishRecord(status:'completed'|'stopped',ms:number){const current=run.current;if(!current)return;run.current=null;setDraft({...current,status,elapsedMs:Math.min(ms,current.recipe.durationMinutes*60000),endedAt:new Date().toISOString()});}
 function stop(){finishRecord('stopped',engine.current?.elapsedMs()??elapsed);voiceAudio.current?.pause();ticket.current++;engine.current?.stop();setState('idle');setElapsed(0);setMessage('Audio detenido. No se ha guardado un registro.');}
 async function play(preview:boolean,resume=false){
  if(!preview&&!resume&&draft)return;
  if(!resume)finishRecord('stopped',engine.current?.elapsedMs()??elapsed);
  voiceAudio.current?.pause();
  const id=++ticket.current;engine.current?.stop();setState('starting');setMessage('');
  setMode(preview?'preview':'practice');
  const offset=resume?elapsed:0;
  // Let the existing engine finish its short stop ramp before starting another graph.
  await new Promise(resolve=>setTimeout(resolve,60));if(id!==ticket.current)return;
  engine.current??=new MarinaComposerAudio(undefined,()=>getAudioEngine().stop(),()=>{setState('paused');setMessage('El navegador interrumpió el audio. Pulsa Reanudar.');});
  try{const started=await engine.current.play(recipe,volume,offset,preview?15:undefined);if(id!==ticket.current)return;if(started){if(!preview&&!resume)run.current={id:crypto.randomUUID(),versionId,recipe:structuredClone(recipe),initialVolume:volume,volumeChanges:[],startedAt:new Date().toISOString(),endedAt:new Date().toISOString(),status:'stopped',elapsedMs:0,experience:''};setElapsed(offset);setState(preview?'preview':'playing');}}
  catch(error){if(id===ticket.current){setState('idle');setMessage((error as Error).message);}}
 }
 function choose(next:string){stop();setLoaded(null);setVersionId(undefined);setChoice(next);setMinutes(next==='focus'?10:6);}
 return <section className="rl-quick" aria-label="Práctica rápida">
  <h2>Una práctica sencilla</h2><p>Elige una intención y escucha antes de comenzar. Estas recetas son puntos de partida para observar tu experiencia.</p>
  <fieldset><legend>Hoy quiero</legend><label><input type="radio" name="quick-purpose" checked={!loaded&&choice==='focus'} onChange={()=>choose('focus')}/> Concentrarme · Foco 15</label><label><input type="radio" name="quick-purpose" checked={!loaded&&choice==='calm'} onChange={()=>choose('calm')}/> Calmarme · Punto Cero 7.8</label></fieldset>
  <label>Duración de la práctica<select aria-label="Duración de la práctica" disabled={busy} value={minutes} onChange={e=>{setVersionId(undefined);setMinutes(Number(e.target.value));setElapsed(0);setState('idle');}}>{[...new Set([5,6,10,15,20,minutes])].sort((a,b)=>a-b).map(n=><option key={n} value={n}>{n} minutos</option>)}</select></label>
  <p><strong>{recipe.name}</strong> · Sin narración · Audífonos estéreo para la diferencia binaural.</p>
  <div role="group" aria-label="Reproductor de práctica rápida" className="rl-quick-controls">
   <button type="button" disabled={state==='starting'} onClick={()=>void play(true)}>Escuchar muestra · 15 s</button>
   <button type="button" disabled={state==='starting'||state==='playing'||(!!draft&&state!=='paused')} onClick={()=>void play(false,state==='paused'&&mode==='practice')}>{state==='paused'&&mode==='practice'?'Reanudar práctica':'Comenzar práctica'}</button>
   {state==='playing'&&<button type="button" onClick={()=>{setElapsed(engine.current?.elapsedMs()??0);engine.current?.stop();setState('paused');}}>Pausar práctica</button>}
   <button type="button" disabled={!busy} onClick={stop}>Detener audio</button>
  </div>
  <p role="status">{state==='starting'?'Preparando audio…':state==='preview'?`Muestra · ${clock(Math.max(0,15000-elapsed))} restantes`:state==='playing'||state==='paused'?`${state==='paused'?'Pausada':'Práctica'} · ${clock(Math.max(0,total-elapsed))} restantes`:message||'Lista para escuchar. La muestra no crea registros.'}</p>
  <label>Volumen · {Math.round(volume*100)} %<input aria-label="Volumen de práctica rápida" type="range" min="0" max=".6" step=".01" value={volume} onChange={e=>{const v=Number(e.target.value);setVolume(v);if(state==='playing'||state==='paused'){const atMs=engine.current?.elapsedMs()??elapsed;run.current?.volumeChanges.push({atMs,volume:v});}else setVersionId(undefined);engine.current?.setVolume(v);}}/></label>
  <details><summary>Detalles acústicos</summary><p>Duración: {minutes} minutos. Transición: {recipe.transitionSeconds} segundos. La muestra reproduce los primeros 15 segundos de la misma mezcla.</p><ul>{recipe.layers.filter(l=>l.enabled).map(l=><li key={l.id}>{layerLabel(l)}</li>)}</ul></details>
  <SessionDownload disabled={busy} score={()=>composerScore(recipe,volume)}/>
  <QuickRecordsPanel recipe={recipe} volume={volume} busy={busy} draft={draft} onDiscard={()=>setDraft(null)} onLoad={(r,v,id)=>{stop();setLoaded(r);setMinutes(r.durationMinutes);setVolume(v);setVersionId(id);}}/>
  <aside><h3>¿Prefieres una práctica guiada?</h3><p>Marina · 24 minutos: Arthur {guideCues(MARINA_PHASES, 'marina').length === MARINA_PHASES.length ? 'completo' : 'parcial'}, {guideCues(MARINA_PHASES, 'marina').length} de {MARINA_PHASES.length} fases. Activa «Leer instrucciones con voz» dentro del módulo. Las otras fases conservan su guía escrita.</p><audio ref={voiceAudio} controls preload="none" aria-label="Muestra disponible de Arthur para Marina" src="/audio/arthur-es-v1/marina-zero.mp3" onPlay={()=>{finishRecord('stopped',engine.current?.elapsedMs()??elapsed);ticket.current++;engine.current?.dispose();engine.current=null;setElapsed(0);setState('voice');setMessage('Muestra de Arthur: instrucción inicial de Marina.');}} onPause={()=>{if(state==='voice')setState('idle');}} onEnded={()=>setState('idle')} onError={()=>{setState('idle');setMessage('No se pudo cargar la muestra de Arthur. Reintenta dentro de Marina.');}}/><Link href="/marina-punto-cero" onClick={stop}>Abrir práctica guiada de Marina</Link></aside>
 </section>;
}
