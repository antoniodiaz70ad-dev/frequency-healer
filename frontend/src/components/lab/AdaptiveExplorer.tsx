'use client';
import { useEffect, useRef, useState } from 'react';
import { suggestNext, type AdaptiveExplorationSuggestionV1 } from '@/lib/adaptive/policy';
import { AdaptiveExperimentStore, ADAPTIVE_EXPERIMENTS_KEY, adaptiveFollowups, type AdaptiveExperimentV1 } from '@/lib/adaptive/storage';
import { personalize, type PersonalizedRecommendationSetV1 } from '@/lib/personalization/ranking';
import { DiscoveryStore, DISCOVERY_KEY } from '@/lib/discovery/storage';
import { nextAssignment, same, stateInput, type ProtocolDiscoveryPlanV1 } from '@/lib/discovery/model';
import { prepareExperimentV2, transitionExperimentV2 } from '@/lib/experiments/v2';
import { STATE_FIELDS } from '@/lib/experiments/types';
import { buildSchedule } from '@/lib/harmonic/math';
import type { DiscoveryPlaybackRequest } from './ProtocolDiscovery';
import ProtocolRationale from './ProtocolRationale';
import SessionPlan from '../voice/SessionPlan';
import styles from '../voice/voice.module.css';
const labels={clarity:'Claridad',tension:'Tensión',focus:'Enfoque',energy:'Energía',mood:'Ánimo'};
const reasons={
  'no-personal-evidence':'No hay pares comparables. Se propone el primer candidato en el orden original.',
  'insufficient-sample':'Este candidato tiene el menor N y aún no alcanza cinco pares comparables. La señal temprana no lo declara superior.',
  'candidate-imbalance':'La diferencia de cobertura es de al menos cinco sesiones. Se propone el candidato menos probado.',
  'uncertainty-reduction':'Se propone revisar incertidumbre descriptiva: variabilidad, expectativas distintas o ausencia de una señal establecida.',
  'confirm-current-signal':'Se propone comprobar la consistencia de la mejor señal actual establecida por Phase 2D.',
};
const exportRaw=(text:string,name:string)=>{const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function Ratings({title,value,set}:{title:string;value:Record<string,string>;set(v:Record<string,string>):void}){return <fieldset><legend>{title} · opcional 0–10</legend><div className={styles.grid}>{STATE_FIELDS.map(k=><label key={k}>{title} {labels[k]}<select value={value[k]??''} onChange={e=>set({...value,[k]:e.target.value})}><option value="">Sin registrar</option>{Array.from({length:11},(_,n)=><option key={n} value={n}>{n}</option>)}</select></label>)}</div></fieldset>;}
export default function AdaptiveExplorer({evidence,plans,active,disabled,onConfirm,onStop}:{evidence:PersonalizedRecommendationSetV1;plans:ProtocolDiscoveryPlanV1[];active:boolean;disabled:boolean;onConfirm(request:DiscoveryPlaybackRequest):Promise<void>;onStop():void}){
  const [suggestion,setSuggestion]=useState<AdaptiveExplorationSuggestionV1|null>(null),[chosen,setChosen]=useState(''),[alternatives,setAlternatives]=useState(false);
  const [expectation,setExpectation]=useState(''),[pre,setPre]=useState<Record<string,string>>({}),[post,setPost]=useState<Record<string,string>>({}),[reflection,setReflection]=useState(''),[consent,setConsent]=useState(false);
  const [outside,setOutside]=useState(false),[fixed,setFixed]=useState<ProtocolDiscoveryPlanV1[]|null>(null),[history,setHistory]=useState<AdaptiveExperimentV1[]>([]),[record,setRecord]=useState<AdaptiveExperimentV1|null>(null);
  const [error,setError]=useState(''),[working,setWorking]=useState(false);
  const live=useRef<AdaptiveExperimentV1|null>(null),capture=useRef<{discovery:string|null;adaptive:string|null}|null>(null),mounted=useRef(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const current=suggestion&&same(suggestion.basis,evidence)?suggestion:null;
  const fixedPlans=(fixed??plans).filter(p=>p.status==='active');
  const selected=current?.candidates.find(c=>c.candidateId===chosen),next=current?.candidates.find(c=>c.candidateId===current.suggestedNextCandidateId);
  const blocked=disabled||active||working||!!record;
  async function run(operation:()=>Promise<void>){if(working)return;setWorking(true);setError('');try{await operation();}catch(e){if(mounted.current)setError((e as Error).message);}finally{if(mounted.current)setWorking(false);}}
  function choose(id:string){setChosen(id);setExpectation('');setPre({});setPost({});setReflection('');setConsent(false);}
  return <details><summary>Próxima sesión informativa · exploración opcional</summary><section aria-label="Exploración adaptativa">
    <h3>Mejor señal actual</h3><p>{evidence.orderingApplied?`${evidence.recommendations[0].candidate.label} · N=${evidence.recommendations[0].comparableN} · Phase 2D`: 'Phase 2D no establece aún una mejor señal; conserva su orden original.'}</p>
    <p>La mejor señal usa Discovery. La próxima prueba añade los resultados exploratorios guardados y comparables, sin cambiar el ranking ni los planes. No hay probabilidades de eficacia ni reproducción automática.</p>
    {error&&<p role="alert">{error}</p>}
    {fixedPlans.length>0&&<section aria-label="Planes fijos activos"><h4>Siguiente asignación fija</h4>{fixedPlans.map(p=>{const a=nextAssignment(p);return <p key={p.id}>{p.id}: {a?`${p.candidates.find(c=>c.id===a.candidateId)!.label} · asignación ${a.index+1} · ${a.status}`:'sin asignación disponible'}. El calendario no se adapta.</p>;})}
      <label><input type="checkbox" disabled={blocked} checked={outside} onChange={e=>{setOutside(e.target.checked);setChosen('');}}/>Quiero una exploración fuera de estos planes fijos</label>
    </section>}
    <button disabled={blocked} onClick={()=>void run(async()=>{
      setSuggestion(null);setChosen('');setOutside(false);setAlternatives(false);
      const original={discovery:localStorage.getItem(DISCOVERY_KEY),adaptive:localStorage.getItem(ADAPTIVE_EXPERIMENTS_KEY)};
      const [rows,audits]=await Promise.all([new DiscoveryStore(localStorage).load(),new AdaptiveExperimentStore(localStorage).load()]);
      const basis=await personalize(rows,evidence.anchorPlanId,evidence.context);
      if(!same(basis,evidence))throw new Error('Discovery cambió. Genera de nuevo las recomendaciones personales.');
      const value=await suggestNext(basis,adaptiveFollowups(audits,basis));
      if(localStorage.getItem(DISCOVERY_KEY)!==original.discovery||localStorage.getItem(ADAPTIVE_EXPERIMENTS_KEY)!==original.adaptive)throw new Error('La evidencia cambió durante el cálculo. Reintenta.');
      if(!mounted.current)return;capture.current=original;setFixed(rows);setHistory(audits);setSuggestion(value);
    })}>Generar próxima sugerencia</button>
    <button onClick={()=>{try{exportRaw(localStorage.getItem(ADAPTIVE_EXPERIMENTS_KEY)??'null','adaptive-original.json');}catch(e){setError((e as Error).message);}}}>Exportar historial adaptativo original</button>
    {current&&next&&<><h3>Próxima sesión informativa</h3><p>{next.candidate.label} · N = {next.comparableN} · {next.evidenceLevel}</p>
      <section aria-label="Por qué esta próxima sesión"><h4>¿Por qué probar esta sesión ahora?</h4><p>{reasons[current.reason]}</p>
        <p>Motivo: {current.reason} · Criterio: {current.explanation.criterion} · {current.algorithmVersion}.</p>
        <p>Métrica: {labels[current.targetMetric]} · Cambio medio {next.change.mean??'Sin datos'} · mediana {next.change.median??'Sin datos'} · rango {next.change.min??'—'}–{next.change.max??'—'}.</p>
        <p>Expectativa media {next.expectation.mean??'Sin datos'} · Brecha entre candidatos {current.explanation.expectationDifference??'Sin datos'}. {current.explanation.expectationConfound?'Hay expectativas distintas; no se corrige causalmente.':'La expectativa sigue siendo un posible factor de confusión.'}</p>
        <p>Umbrales del producto: N mínimo 5; desequilibrio 5; rango variable ≥4 o diferencia media–mediana ≥1; brecha de expectativa ≥2. No son pruebas científicas. Una sesión adicional no garantiza resolver la incertidumbre.</p>
      </section>
      <button disabled={blocked||(fixedPlans.length>0&&!outside)} onClick={()=>choose(current.suggestedNextCandidateId)}>Usar esta sesión · vista previa</button>
      <button disabled={blocked} onClick={()=>setAlternatives(true)}>Elegir otra opción válida</button>
      {alternatives&&<fieldset disabled={blocked||(fixedPlans.length>0&&!outside)}><legend>Alternativas sin penalización</legend>{current.candidates.map(c=><button key={c.candidateId} onClick={()=>choose(c.candidateId)}>Explorar {c.candidate.label} · vista previa</button>)}</fieldset>}
      <details><summary>¿Qué hemos explorado?</summary><p>Cobertura de candidatos existentes; no es necesario probar todas las configuraciones posibles. N cuenta solo pares completados. HIP/HCI no determina la prioridad.</p>
        {current.candidates.map(c=><section key={c.candidateId} aria-label={`Cobertura ${c.candidateId}`}><h4>{c.candidate.label}</h4><p>N={c.comparableN}: Discovery {c.discoveryN} + exploración {c.adaptiveN}. Completadas {c.completionCount}, canceladas {c.cancelledCount}, interrumpidas {c.interruptedCount}, pares incompletos {c.incompletePairCount}; solo resultados registrados en este contexto.</p><p>Media {c.change.mean??'Sin datos'} · mediana {c.change.median??'Sin datos'} · amplitud {c.spread??'Sin datos'} · separación media/mediana {c.meanMedianGap??'Sin datos'} · expectativa media {c.expectation.mean??'Sin datos'}.</p><ProtocolRationale value={c.candidate.rationale} config={c.candidate.config} constellation={c.candidate.constellation}/></section>)}
        <pre>{JSON.stringify(current.coverage,null,2)}</pre><details><summary>Procedencia y snapshots exactos</summary><pre>{JSON.stringify(current,null,2)}</pre></details>
      </details>
      <button onClick={()=>exportRaw(JSON.stringify(current,null,2),'adaptive-suggestion-v1.json')}>Exportar sugerencia adaptativa</button>
    </>}
    {selected&&current&&!record&&<section aria-label="Vista previa adaptativa"><h4>Elegida: {selected.candidate.label}</h4><p>{chosen===current.suggestedNextCandidateId?'Sigues la sugerencia.':'Elegiste una alternativa válida, sin penalización.'} Esta elección todavía no reproduce.</p><SessionPlan config={selected.candidate.config} schedule={buildSchedule(selected.candidate.config)}/><p>Contexto: {JSON.stringify(current.basis.context)}.</p>
      <fieldset disabled={active||working||disabled}><label>Expectativa exploratoria (0–10, requerida)<select value={expectation} onChange={e=>setExpectation(e.target.value)}><option value="">Sin registrar</option>{Array.from({length:11},(_,n)=><option key={n} value={n}>{n}</option>)}</select></label><Ratings title="Antes exploración" value={pre} set={setPre}/>
      {selected.candidate.config.ratioId==='cascade-13-12'&&<label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>Acepto la cascada experimental de exploración</label>}
      <button disabled={expectation===''||(fixedPlans.length>0&&!outside)||(selected.candidate.config.ratioId==='cascade-13-12'&&!consent)} onClick={()=>void onConfirm({
        prepare:async()=>{
          const original=capture.current;if(!original||localStorage.getItem(DISCOVERY_KEY)!==original.discovery||localStorage.getItem(ADAPTIVE_EXPERIMENTS_KEY)!==original.adaptive)throw new Error('La evidencia o los planes cambiaron. Genera otra sugerencia.');
          const [rows,audits]=await Promise.all([new DiscoveryStore(localStorage).load(),new AdaptiveExperimentStore(localStorage).load()]);
          if(rows.some(p=>p.status==='active')&&!outside)throw new Error('Confirma que esta exploración está fuera del plan fijo.');
          const basis=await personalize(rows,evidence.anchorPlanId,evidence.context),fresh=await suggestNext(basis,adaptiveFollowups(audits,basis));
          if(!same(fresh,current))throw new Error('La sugerencia cambió. Vuelve a revisar.');
          if(expectation==='')throw new Error('Registra la expectativa.');const c=fresh.candidates.find(c=>c.candidateId===chosen)!.candidate;
          const experiment=await prepareExperimentV2(c.config,{intention:basis.intent.intent.intention,context:JSON.stringify(basis.context),expectationScore:Number(expectation),preState:stateInput(pre)},c.constellation);
          if(localStorage.getItem(DISCOVERY_KEY)!==original.discovery||localStorage.getItem(ADAPTIVE_EXPERIMENTS_KEY)!==original.adaptive)throw new Error('La evidencia cambió durante la confirmación. Genera otra sugerencia.');
          live.current={schemaVersion:1,suggestion:fresh,chosenCandidateId:chosen,suggestionFollowed:chosen===fresh.suggestedNextCandidateId,experiment};if(mounted.current)setRecord(live.current);return c.config;
        },
        started:()=>{if(live.current){live.current={...live.current,experiment:transitionExperimentV2(live.current.experiment,'started')};if(mounted.current)setRecord(live.current);}},
        finished:(status,notify=true)=>{if(live.current){live.current={...live.current,experiment:transitionExperimentV2(live.current.experiment,status)};if(notify&&mounted.current)setRecord(live.current);}},
      })}>Confirmar y reproducir exploración</button></fieldset>
    </section>}
    {record&&<section aria-label="Resultado adaptativo"><h4>Exploración: {record.experiment.status} · sin guardar</h4>{active?<button onClick={onStop}>Detener exploración</button>:<fieldset disabled={working}>
      <Ratings title="Después exploración" value={post} set={setPost}/><label>Reflexión exploratoria<textarea maxLength={2000} value={reflection} onChange={e=>setReflection(e.target.value)}/></label>
      <button onClick={()=>void run(async()=>{if(!live.current)throw new Error('Sin borrador.');const value={...live.current,experiment:{...live.current.experiment,postState:stateInput(post),...(reflection.trim()?{reflection}:{})}};setHistory(await new AdaptiveExperimentStore(localStorage).save(value));live.current=null;setRecord(null);setChosen('');setSuggestion(null);})}>Guardar resultado exploratorio</button>
      <button onClick={()=>exportRaw(JSON.stringify({...record,experiment:{...record.experiment,postState:stateInput(post),...(reflection.trim()?{reflection}:{})}},null,2),'adaptive-unsaved.json')}>Exportar borrador exploratorio</button>
    </fieldset>}<p>Sin guardado automático. Navegar descarta el borrador. El siguiente cálculo explícito podrá incorporar un resultado guardado, completo y comparable, independientemente de si seguiste la sugerencia.</p></section>}
    <details><summary>Resultados exploratorios guardados ({history.length})</summary>{history.map(r=><div key={r.experiment.id}><p>{r.experiment.id} · {r.experiment.status} · sugerida {r.suggestion.suggestedNextCandidateId} · elegida {r.chosenCandidateId} · {r.suggestionFollowed?'aceptada':'alternativa'}</p><button onClick={()=>exportRaw(JSON.stringify(r,null,2),`adaptive-${r.experiment.id}.json`)}>Exportar resultado exploratorio {r.experiment.id}</button></div>)}</details>
  </section></details>;
}
