'use client';
import { useEffect, useRef, useState } from 'react';
import { interpretGuidedIntent, recommendGuided, type GuidedInterpretationV1 } from '@/lib/guided/recommendations';
import { GOALS } from '@/lib/voice/types';
import { dictionaries } from '@/lib/voice/i18n';
import { buildSchedule, type HarmonicConfig } from '@/lib/harmonic/math';
import { ConstellationStore } from '@/lib/harmonic/constellationStorage';
import type { HarmonicConstellationV1 } from '@/lib/harmonic/constellations';
import { prepareExperimentV2, transitionExperimentV2, validateExperimentV2, type ExperimentRecordV2 } from '@/lib/experiments/v2';
import { STATE_FIELDS } from '@/lib/experiments/types';
import { candidate, createPlan, validatePlan, validateContext, nextAssignment, stateInput, type ProtocolDiscoveryPlanV1, type DiscoveryContextV1, type TargetMetric, type Strategy } from '@/lib/discovery/model';
import { DiscoveryStore, DISCOVERY_KEY } from '@/lib/discovery/storage';
import { analyzePlan } from '@/lib/discovery/analysis';
import ProtocolRationale from './ProtocolRationale';
import SessionPlan from '../voice/SessionPlan';
import styles from '../voice/voice.module.css';
export interface DiscoveryPlaybackRequest {
  prepare():Promise<HarmonicConfig>;
  started():void;
  finished(status:'completed'|'cancelled'|'interrupted',notify?:boolean):void;
}
const labels={clarity:'Claridad',tension:'Tensión',focus:'Enfoque',energy:'Energía',mood:'Ánimo'};
const levels={insufficient:'Datos insuficientes para comparar',exploratory:'Exploratorio',preliminary:'Comparación descriptiva preliminar',descriptive:'Patrón personal descriptivo'};
const exportRaw=(text:string,name:string)=>{const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
const exportJSON=(value:unknown,name:string)=>exportRaw(JSON.stringify(value,null,2),name);
function Ratings({title,value,set}:{title:string;value:Record<string,string>;set(v:Record<string,string>):void}){return <fieldset><legend>{title} · opcional 0–10</legend><div className={styles.grid}>{STATE_FIELDS.map(k=><label key={k}>{title} {labels[k]}<select value={value[k]??''} onChange={e=>set({...value,[k]:e.target.value})}><option value="">Sin registrar</option>{Array.from({length:11},(_,n)=><option key={n} value={n}>{n}</option>)}</select></label>)}</div></fieldset>;}
export default function ProtocolDiscovery({active,onConfirm,onStop}:{active:boolean;onConfirm(request:DiscoveryPlaybackRequest):Promise<void>;onStop():void}){
  const [plans,setPlans]=useState<ProtocolDiscoveryPlanV1[]>([]),[selected,setSelected]=useState(''),[draft,setDraft]=useState<ProtocolDiscoveryPlanV1|null>(null);
  const [words,setWords]=useState(''),[intent,setIntent]=useState<GuidedInterpretationV1|null>(null),[seeds,setSeeds]=useState('');
  const [metric,setMetric]=useState<TargetMetric>('energy'),[rounds,setRounds]=useState(5),[strategy,setStrategy]=useState<Strategy>('balanced');
  const [mode,setMode]=useState<HarmonicConfig['mode']>('sequence'),[volume,setVolume]=useState(15),[seconds,setSeconds]=useState(900);
  const [sources,setSources]=useState<HarmonicConstellationV1[]>([]),[chosen,setChosen]=useState<string[]>([]),[sourceKind,setSourceKind]=useState('seeds');
  const [preview,setPreview]=useState<ProtocolDiscoveryPlanV1|null>(null),[expectation,setExpectation]=useState(''),[tags,setTags]=useState(''),[device,setDevice]=useState(''),[time,setTime]=useState('');
  const [pre,setPre]=useState<Record<string,string>>({}),[post,setPost]=useState<Record<string,string>>({}),[reflection,setReflection]=useState(''),[consent,setConsent]=useState(false);
  const [record,setRecord]=useState<ExperimentRecordV2|null>(null),[error,setError]=useState(''),[working,setWorking]=useState(false),[stratum,setStratum]=useState('');
  const live=useRef<{plan:ProtocolDiscoveryPlanV1;context:DiscoveryContextV1;experiment:ExperimentRecordV2}|null>(null),mounted=useRef(false),ticket=useRef(0);
  const plan=plans.find(p=>p.id===selected),next=plan?nextAssignment(plan):undefined;
  const candidateNow=preview&&nextAssignment(preview)?preview.candidates.find(c=>c.id===nextAssignment(preview)!.candidateId):undefined;
  const blocked=active||working;
  useEffect(()=>{mounted.current=true;let alive=true;const refresh=async()=>{const n=++ticket.current;try{const rows=await new DiscoveryStore(localStorage).load();if(alive&&n===ticket.current){setPlans(rows);setPreview(null);}}catch(e){if(alive)setError((e as Error).message);}};void refresh();const changed=(e:StorageEvent)=>{if(e.key===DISCOVERY_KEY||e.key===null)void refresh();};window.addEventListener('storage',changed);return()=>{alive=false;mounted.current=false;window.removeEventListener('storage',changed);};},[]);
  async function run(operation:()=>Promise<void>){if(working)return;setWorking(true);setError('');try{await operation();}catch(e){if(mounted.current)setError((e as Error).message);}finally{if(mounted.current)setWorking(false);}}
  function update(rows:ProtocolDiscoveryPlanV1[]){++ticket.current;if(mounted.current)setPlans(rows);}
  const summary=plan?analyzePlan(plan,stratum||undefined):null;
  return <details><summary>Protocol Discovery · comparación personal</summary><section aria-label="Protocol Discovery"><h2>Protocol Discovery</h2>
    <p>Compara arquitecturas bajo una intención común. Observación N=1, sin prueba causal ni frecuencia universal. El orden se guarda antes de escuchar; las omisiones no se reemplazan.</p>
    {error&&<p role="alert">{error}</p>}
    <button disabled={blocked} onClick={()=>{try{exportRaw(localStorage.getItem(DISCOVERY_KEY)??'null','discovery-original.json');}catch(e){setError((e as Error).message);}}}>Exportar almacenamiento Discovery original</button>
    <fieldset disabled={blocked||!!record}><legend>Crear un plan fijo</legend>
      <label>Intención Discovery<textarea maxLength={500} value={words} onChange={e=>{setWords(e.target.value);setIntent(null);setDraft(null);}}/></label>
      <button onClick={()=>{try{const parsed=interpretGuidedIntent(words);setIntent(parsed);setSeconds(parsed.intent.durationMinutes*60);setVolume(recommendGuided(parsed).proposal.harmonicConfig.uiVolume);setDraft(null);setError('');}catch(e){setError((e as Error).message);}}}>Interpretar intención Discovery</button>
      {intent&&<><p>{intent.explanation}</p><label>Objetivo Discovery<select value={intent.intent.goal} onChange={e=>{setIntent({...intent,intent:{...intent.intent,goal:e.target.value as typeof intent.intent.goal,desiredStates:[]},explanation:'Objetivo corregido explícitamente.'});setDraft(null);}}>{GOALS.map(g=><option key={g} value={g}>{dictionaries.es.goals[g]}</option>)}</select></label>
      <label>Métrica primaria<select value={metric} onChange={e=>{setMetric(e.target.value as TargetMetric);setDraft(null);}}>{STATE_FIELDS.map(k=><option key={k} value={k}>{labels[k]}</option>)}</select></label>
      <label>Origen de candidatos<select value={sourceKind} onChange={e=>{setSourceKind(e.target.value);setDraft(null);}}><option value="seeds">Regla actual con semillas elegidas por mí</option><option value="saved">Constelaciones guardadas</option></select></label>
      {sourceKind==='seeds'?<label>Semillas elegidas (2–3 Hz separados por coma)<input value={seeds} onChange={e=>{setSeeds(e.target.value);setDraft(null);}} placeholder="Escribe tus propios valores"/></label>:<><button onClick={()=>void run(async()=>{setSources(await new ConstellationStore(localStorage).load());setChosen([]);setDraft(null);})}>Cargar constelaciones para comparar</button>{sources.map(c=><label key={c.id}><input type="checkbox" checked={chosen.includes(c.id)} onChange={e=>{setChosen(e.target.checked?[...chosen,c.id]:chosen.filter(id=>id!==c.id));setDraft(null);}}/>{c.name||c.id} · {c.seedFrequencyHz} Hz · {c.playbackMode}</label>)}</>}
      <div className={styles.grid}><label>Duración Discovery (segundos)<input type="number" min={sourceKind==='seeds'?300:1} max={3600} value={seconds} onChange={e=>{setSeconds(Number(e.target.value));setDraft(null);}}/></label><label>Volumen Discovery<input type="number" min={0} max={100} value={volume} onChange={e=>{setVolume(Number(e.target.value));setDraft(null);}}/></label><label>Modo controlado<select value={mode} onChange={e=>{setMode(e.target.value as typeof mode);setDraft(null);}}><option value="sequence">Secuencia</option><option value="simultaneous">Simultáneo</option></select></label>
      <label>Asignaciones por candidato<input type="number" min={3} max={10} value={rounds} onChange={e=>{setRounds(Number(e.target.value));setDraft(null);}}/></label><label>Estrategia Discovery<select value={strategy} onChange={e=>{setStrategy(e.target.value as Strategy);setDraft(null);}}><option value="balanced">Balanceada</option><option value="randomized-balanced">Aleatoria balanceada</option></select></label></div>
      <button onClick={()=>void run(async()=>{
        const reviewed={...intent,intent:{...intent.intent,durationMinutes:sourceKind==='seeds'?seconds/60:intent.intent.durationMinutes}};
        const base=recommendGuided(reviewed).proposal.harmonicConfig;
        const selectedSources=chosen.map(id=>sources.find(c=>c.id===id)!);
        const values=sourceKind==='seeds'?seeds.split(',').map(v=>{if(!v.trim())throw new Error('Escribe todas las semillas explícitamente.');return Number(v);}):selectedSources.map(c=>c.seedFrequencyHz);
        const candidates=await Promise.all(values.map((seed,i)=>candidate(reviewed,`candidate-${i+1}`,`Protocolo ${String.fromCharCode(65+i)}`,{...base,baseHz:seed,mode,durationSeconds:seconds,uiVolume:volume},sourceKind==='saved'?selectedSources[i]:undefined)));
        setDraft(await createPlan({intent:reviewed,primaryMetric:metric,candidates,assignmentStrategy:strategy,randomSeed:crypto.getRandomValues(new Uint32Array(1))[0],minimumSessionsPerCandidate:rounds}));
      })}>Validar candidatos y crear borrador</button></>}
    </fieldset>
    {draft&&<div><h3>Revisar plan antes de guardarlo</h3><p>{draft.candidates.length} candidatos · {draft.assignments.length} asignaciones · orden fijo.</p>{draft.candidates.map(c=><div key={c.id}><h4>{c.label} · {c.metadata.seedFrequencyHz} Hz</h4><SessionPlan config={c.config} schedule={buildSchedule(c.config)}/><ProtocolRationale value={c.rationale}/></div>)}<button disabled={blocked||!!record} onClick={()=>void run(async()=>{update(await new DiscoveryStore(localStorage).create(draft));setSelected(draft.id);setDraft(null);})}>Guardar plan Discovery</button></div>}
    <label>Plan guardado<select disabled={blocked||!!record} value={selected} onChange={e=>{setSelected(e.target.value);setPreview(null);setStratum('');}}><option value="">Selecciona un plan</option>{plans.map(p=><option key={p.id} value={p.id}>{p.intent.intent.intention} · {p.status}</option>)}</select></label>
    {plan&&summary&&<div><h3>Plan: {plan.intent.intent.intention}</h3><p>Estado: {plan.status} · Métrica: {labels[plan.primaryMetric]} · Candidatos: {plan.candidates.length}</p><p>Completadas: {plan.assignments.filter(a=>a.status==='completed').length} · Asignaciones restantes: {plan.assignments.filter(a=>['pending','reserved'].includes(a.status)).length}</p>
      <button onClick={()=>exportJSON(plan,`discovery-${plan.id}.json`)}>Exportar plan y resultados</button>
      {plan.status==='draft'&&<button disabled={blocked} onClick={()=>void run(async()=>update(await new DiscoveryStore(localStorage).act(plan,{kind:'activate'})))}>Activar plan Discovery</button>}
      {plan.status==='active'&&next&&<><h4>Siguiente asignación: {next.index+1} · {plan.candidates.find(c=>c.id===next.candidateId)!.label} · {next.status}</h4>
      {next.status==='pending'&&!record&&<><button disabled={blocked} onClick={()=>{setPreview(plan);setPre({});setPost({});setExpectation('');setTags('');setDevice('');setTime('');setReflection('');setConsent(false);}}>Preparar siguiente asignación</button><button disabled={blocked} onClick={()=>void run(async()=>{update(await new DiscoveryStore(localStorage).act(plan,{kind:'skip'}));setPreview(null);})}>Omitir asignación (registrar omisión)</button><button disabled={blocked} onClick={()=>void run(async()=>{update(await new DiscoveryStore(localStorage).act(plan,{kind:'cancel'}));setPreview(null);})}>Cancelar plan Discovery</button></>}
      {next.status==='reserved'&&!record&&<><p>Esta asignación tiene una reserva sin resultado guardado. Puede seguir activa en otra pestaña. Cierra solo si se interrumpió; no se marcará completada ni se inventará un experimento.</p><button disabled={blocked} onClick={()=>void run(async()=>update(await new DiscoveryStore(localStorage).act(plan,{kind:'interrupt'})))}>Confirmar cierre como interrumpida</button></>}
      </>}
      <h3>Observaciones actuales</h3><label>Comparar contexto registrado<select value={stratum} onChange={e=>setStratum(e.target.value)}><option value="">Todos (sin comparación si difieren)</option>{summary.groups.map(g=><option key={g} value={g}>{g}</option>)}</select></label>
      <p>{levels[summary.evidence]} · {summary.comparisonAvailable?'Comparación descriptiva disponible':'Sin comparación entre candidatos'}</p>{summary.mixedContext&&<p>Los contextos difieren. Selecciona el mismo contexto registrado; no se agrupan para comparar.</p>}
      {summary.rows.map(row=><div key={row.candidateId}><h4>{plan.candidates.find(c=>c.id===row.candidateId)!.label}</h4><p>N completadas: {row.completed} · N con pares: {row.change.n} · Media: {row.change.mean??'Sin datos'} · Mediana: {row.change.median??'Sin datos'} · Rango: {row.change.min??'—'} a {row.change.max??'—'}</p><p>Expectativa media: {row.expectationAverage??'Sin datos'} · Estado previo medio: {row.baseline.mean??'Sin datos'} · Finalización: {row.completionRate===null?'Sin intentos resueltos':`${(row.completionRate*100).toFixed(0)}%`} · Omitidas: {row.skipped}</p><p>Expectativa vs cambio (correlación descriptiva): {row.expectationAssociation??'Datos insuficientes o sin variación'}. No es diagnóstico ni causalidad.</p><details><summary>Estructura conservada · {row.candidateId}</summary><pre>{JSON.stringify(row.metadata,null,2)}</pre></details></div>)}
      <p>{summary.limitations}</p><p>Un plan completado significa que se resolvió su calendario, no que haya suficientes sesiones completadas para comparar.</p><p>Los umbrales N=3/5/10 son reglas de visualización del producto, no prueba científica. No hay ganador automático ni adaptación.</p>
      <details><summary>Plan exacto, orden y resultados</summary><pre>{JSON.stringify(plan,null,2)}</pre></details>
    </div>}
    {candidateNow&&preview&&!record&&<section aria-label="Vista previa Discovery"><h3>Asignación para confirmar · {candidateNow.label}</h3><p>Se usa el snapshot fijo del plan aunque cambie o desaparezca la fuente. Cargar o previsualizar no reproduce.</p><SessionPlan config={candidateNow.config} schedule={buildSchedule(candidateNow.config)}/><ProtocolRationale value={candidateNow.rationale}/>
      <fieldset disabled={blocked}><label>Expectativa Discovery (0–10, requerida)<select value={expectation} onChange={e=>setExpectation(e.target.value)}><option value="">Sin registrar</option>{Array.from({length:11},(_,n)=><option key={n} value={n}>{n}</option>)}</select></label><Ratings title="Antes Discovery" value={pre} set={setPre}/>
      <label>Contexto Discovery (etiquetas opcionales separadas por coma)<input value={tags} onChange={e=>setTags(e.target.value)} maxLength={500}/></label><label>Dispositivo / auriculares (opcional)<input value={device} onChange={e=>setDevice(e.target.value)} maxLength={200}/></label><label>Momento del día (opcional)<input value={time} onChange={e=>setTime(e.target.value)} maxLength={200}/></label>
      {candidateNow.config.ratioId==='cascade-13-12'&&<label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>Acepto la cascada experimental Discovery</label>}
      <button disabled={expectation===''||(candidateNow.config.ratioId==='cascade-13-12'&&!consent)} onClick={()=>void onConfirm({
        prepare:async()=>{
          const checked=await validatePlan(preview),assignment=nextAssignment(checked)!;if(checked.status!=='active'||assignment.status!=='pending')throw new Error('La asignación no está pendiente.');
          const c=checked.candidates.find(c=>c.id===assignment.candidateId)!;
          const context:DiscoveryContextV1={...(tags.trim()?{tags:tags.split(',').map(t=>t.trim()).filter(Boolean)}:{}),...(device.trim()?{device:device.trim()}:{}),...(time.trim()?{timeOfDay:time.trim()}: {})};
          if(expectation==='')throw new Error('Registra la expectativa antes de confirmar.');validateContext(context);
          const value=await prepareExperimentV2(c.config,{intention:checked.intent.intent.intention,expectationScore:Number(expectation),preState:stateInput(pre)},c.constellation);
          const rows=await new DiscoveryStore(localStorage).act(checked,{kind:'reserve',attemptId:value.id});
          const reserved=rows.find(p=>p.id===checked.id)!;live.current={plan:reserved,context,experiment:value};update(rows);if(mounted.current)setRecord(value);return c.config;
        },
        started:()=>{if(live.current){live.current.experiment=transitionExperimentV2(live.current.experiment,'started');if(mounted.current)setRecord(live.current.experiment);}},
        finished:(status,notify=true)=>{if(live.current){live.current.experiment=transitionExperimentV2(live.current.experiment,status);if(notify&&mounted.current)setRecord(live.current.experiment);}},
      })}>Confirmar y reproducir asignación</button></fieldset>
    </section>}
    {record&&<section aria-label="Resultado Discovery"><h3>Resultado: {record.status} · sin guardar</h3>{active?<button onClick={onStop}>Detener asignación Discovery</button>:<><Ratings title="Después Discovery" value={post} set={setPost}/><label>Reflexión Discovery<textarea maxLength={2000} value={reflection} onChange={e=>setReflection(e.target.value)}/></label>
      <button disabled={working} onClick={()=>void run(async()=>{const session=live.current;if(!session)throw new Error('Borrador no disponible.');const a=nextAssignment(session.plan)!;const e=await validateExperimentV2({...session.experiment,postState:stateInput(post),...(reflection.trim()?{reflection}: {})});update(await new DiscoveryStore(localStorage).act(session.plan,{kind:'save',result:{schemaVersion:1,planId:session.plan.id,candidateId:a.candidateId,assignmentIndex:a.index,context:session.context,experiment:e}}));live.current=null;setRecord(null);setPreview(null);})}>Guardar resultado Discovery</button>
      <button disabled={working} onClick={()=>void run(async()=>{const session=live.current;if(!session)throw new Error('Sin borrador.');const a=nextAssignment(session.plan)!;const value=await validateExperimentV2({...session.experiment,postState:stateInput(post),...(reflection.trim()?{reflection}:{})});exportJSON({plan:session.plan,result:{schemaVersion:1,planId:session.plan.id,candidateId:a.candidateId,assignmentIndex:a.index,context:session.context,experiment:value}},'discovery-unsaved.json');})}>Exportar borrador Discovery</button></> }<p>Guardar es explícito. Al salir se pierde este borrador; la reserva sigue visible como no resuelta, nunca como completada.</p></section>}
  </section></details>;
}
