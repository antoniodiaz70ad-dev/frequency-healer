"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {selectSummary,type Selection,type Summary} from '../../../../integrations/base60-frequency-v1/contract.mjs';
import type {BentovSession} from '@/lib/bentov/types';

type Connection={baseOrigin:string;flowId:string;channel:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function ShareSelection({session,onSend,saved,ready}:{session:BentovSession;onSend:(s:Summary)=>void;saved:boolean;ready:boolean}){
 const [shared,setShared]=useState<Selection>({observation:false,interpretation:false,action:false,scores:false});
 const result=useMemo(()=>{try{return {summary:selectSummary(session,shared),error:''};}catch{return {summary:null,error:'Esta sesión contiene datos incoherentes y no se puede compartir. Se conserva el original local.'};}},[session,shared]);
 const s=result.summary;
 return <div className="mt-4 space-y-4">
  <p>Siempre se comparten: identificador de sesión, protocolo, fecha, duración, modalidad, estado e interrupciones.</p>
  <p>{new Date(session.startedAt).toLocaleString('es-MX')} · {(session.elapsedActiveMs/60000).toFixed(1)} min · {session.actualMode==='paced'?'Con pauta':session.actualMode==='natural'?'Natural':'Mixta'} · {session.status==='completed'?'Completada':session.status==='stopped'?'Detenida':'Interrumpida'} · {session.interruptions.length} interrupciones</p>
  <fieldset className="space-y-3"><legend className="font-semibold">Elige qué contenido adicional compartir</legend>
   {(['observation','interpretation','action','scores'] as const).map(k=><label key={k} className="flex items-center gap-3 min-h-11"><input type="checkbox" checked={shared[k]} disabled={saved} onChange={e=>setShared({...shared,[k]:e.target.checked})}/>{k==='observation'?'Observación':k==='interpretation'?'Interpretación':k==='action'?'Acción':'Escalas de tensión y claridad'}</label>)}
  </fieldset>
  {s&&<div className="space-y-2 whitespace-pre-wrap break-words" aria-label="Resumen que se compartirá">
   {(['observation','interpretation','action'] as const).map(k=>shared[k]&&<p key={k}><b>{k==='observation'?'Observación':k==='interpretation'?'Interpretación':'Acción'}:</b> {s[k]||'No registrada'}</p>)}
   {s.scores&&<p>Tensión: {s.scores.tensionPre??'—'} → {s.scores.tensionPost??'—'} · Claridad: {s.scores.clarityPre??'—'} → {s.scores.clarityPost??'—'}</p>}
  </div>}
  {result.error&&<p role="alert">{result.error}</p>}
  <button className="fh-action fh-action--primary" disabled={!ready||!s||saved} onClick={()=>s&&onSend(s)}>{saved?'Guardado en Base60':'Compartir este resumen con Base60'}</button>
  <p className="text-sm">Después debes confirmar «Guardar en mi diario» en Base60. Tu sesión local se conserva.</p>
 </div>;
}
export default function Base60Share({sessions,allowedOrigins,practicing}:{sessions:BentovSession[];allowedOrigins:string[];practicing:boolean}){
 const [connection,setConnection]=useState<Connection|null>(null),[ready,setReady]=useState(false),[expiresAt,setExpiresAt]=useState(0),[selected,setSelected]=useState(''),[saved,setSaved]=useState(''),[message,setMessage]=useState('');
 const sent=useRef<string|null>(null);
 useEffect(()=>{
  const timer=window.setTimeout(()=>{
   const q=new URLSearchParams(window.location.hash.slice(1));if(q.get('bridge')!=='1')return;
   const baseOrigin=q.get('baseOrigin')??'',flowId=q.get('flowId')??'',channel=q.get('channel')??'';
   window.history.replaceState(null,'',window.location.pathname+window.location.search);
   try{const u=new URL(baseOrigin);if(u.protocol!=='https:'||u.origin!==baseOrigin||!allowedOrigins.includes(baseOrigin)||!uuid.test(flowId)||!uuid.test(channel)||!window.opener)throw Error();
    setConnection({baseOrigin,flowId,channel});setMessage('Conectando con la ventana de Base60…');
   }catch{setMessage('No se pudo verificar el destino. Abre una nueva conexión desde Base60.');}
  },0);return()=>window.clearTimeout(timer);
 },[allowedOrigins]);
 useEffect(()=>{
  if(!connection)return;
  const c=connection,opener=window.opener;let connected=false;
  const hello=()=>{if(opener&&!opener.closed)opener.postMessage({type:'fh.ready',version:1,flowId:c.flowId,channel:c.channel},c.baseOrigin);};
  function receive(e:MessageEvent){
   if(e.origin!==c.baseOrigin||e.source!==opener)return;const d=e.data;
   if(!d||d.version!==1||d.flowId!==c.flowId||d.channel!==c.channel)return;
   if(d.type==='base60.ready'&&!connected&&typeof d.expiresAt==='string'){
    const until=Date.parse(d.expiresAt);if(!Number.isFinite(until)||until<=Date.now()||until>Date.now()+3601000)return;
    connected=true;setExpiresAt(until);setReady(true);setMessage('Conexión disponible. Completa y guarda la práctica antes de compartir.');
   }
   if(d.type==='base60.saved'&&d.sessionId===sent.current&&typeof d.entryId==='string'&&uuid.test(d.entryId)){
    setSaved(d.sessionId);setMessage('Base60 confirmó el guardado en tu diario. Tu sesión local se conserva.');sent.current=null;
   }
  }
  window.addEventListener('message',receive);hello();const timer=window.setInterval(hello,10000);
  return()=>{window.removeEventListener('message',receive);window.clearInterval(timer);};
 },[connection]);
 useEffect(()=>{if(!expiresAt)return;const timer=window.setTimeout(()=>{setReady(false);setMessage('La conexión caducó. Abre otra desde Base60 para compartir la sesión guardada.');},Math.max(0,expiresAt-Date.now()));return()=>window.clearTimeout(timer);},[expiresAt]);
 const session=sessions.find(s=>s.id===selected)??sessions.at(-1);
 function send(summary:Summary){
  if(!connection||!ready||Date.now()>=expiresAt||!window.opener||window.opener.closed){setMessage('La ventana de Base60 ya no está disponible. Reconecta desde Base60.');setReady(false);return;}
  sent.current=summary.sessionId;window.opener.postMessage({type:'fh.summary',version:1,flowId:connection.flowId,channel:connection.channel,summary},connection.baseOrigin);
  setMessage('Resumen enviado para revisión. Todavía debes confirmar el guardado en Base60.');
 }
 if(practicing)return null;
 return <section className="rounded-2xl border border-[var(--fh-border)] p-5" aria-label="Compartir con Base60">
  <h2 className="text-xl font-semibold">Llevar la práctica a tu diario</h2>
  {!connection?<p>Para compartir, abre esta práctica desde Mi Tiempo en Base60. No se envía nada automáticamente.</p>:<>
   <p className="mt-2 break-all">Destino verificado: {connection.baseOrigin}</p>
   {session?<><label className="block mt-4">Sesión guardada<select className="block w-full mt-2 rounded-lg p-3 bg-[var(--fh-bg)]" value={session.id} onChange={e=>{setSelected(e.target.value);sent.current=null;setSaved('');}}>{[...sessions].reverse().map(s=><option key={s.id} value={s.id}>{new Date(s.startedAt).toLocaleString('es-MX')} · {s.status==='completed'?'Completada':s.status==='stopped'?'Detenida':'Interrumpida'}</option>)}</select></label><ShareSelection key={session.id} session={session} onSend={send} saved={saved===session.id} ready={ready}/></>:<p className="mt-4">Primero completa y guarda una sesión. También puedes compartir una sesión detenida, identificada como tal.</p>}
   <button className="fh-action fh-action--secondary mt-4" onClick={()=>window.opener?.focus()}>Volver a la ventana de Base60</button>
  </>}
  {message&&<p className="mt-3" role="status">{message}</p>}
 </section>;
}
