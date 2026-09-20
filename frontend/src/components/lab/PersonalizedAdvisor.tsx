'use client';
import { useEffect, useRef, useState } from 'react';
import { DiscoveryStore, DISCOVERY_KEY } from '@/lib/discovery/storage';
import { contextKey } from '@/lib/discovery/analysis';
import { same, stateInput, type DiscoveryContextV1, type ProtocolDiscoveryPlanV1 } from '@/lib/discovery/model';
import { personalize, type PersonalizedRecommendationSetV1 } from '@/lib/personalization/ranking';
import { PERSONALIZED_EXPERIMENTS_KEY, PersonalizedExperimentStore, type PersonalizedExperimentV1 } from '@/lib/personalization/storage';
import { prepareExperimentV2, transitionExperimentV2 } from '@/lib/experiments/v2';
import { STATE_FIELDS } from '@/lib/experiments/types';
import { buildSchedule } from '@/lib/harmonic/math';
import type { DiscoveryPlaybackRequest } from './ProtocolDiscovery';
import ProtocolRationale from './ProtocolRationale';
import StructuralAnalysis from './StructuralAnalysis';
import SessionPlan from '../voice/SessionPlan';
import styles from '../voice/voice.module.css';

const labels = { clarity:'Claridad', tension:'Tensión', focus:'Enfoque', energy:'Energía', mood:'Ánimo' };
const reasons = {
  insufficient:'Datos insuficientes: se conserva el orden original.',
  'preliminary-retain-exploration':'Señal preliminar: se conserva el orden original y todas las alternativas.',
  'expectation-confound':'Las expectativas medias difieren al menos 2 puntos: se conserva el orden original.',
  'no-positive-signal':'Sin señal favorable repetida: se conserva el orden original.',
  'descriptive-order':'Orden por señal personal descriptiva entre estos candidatos comparables.',
};
function download(text:string, name:string) {
  const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
  const link=document.createElement('a'); link.href=url; link.download=name; link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function Ratings({title,value,set}:{title:string;value:Record<string,string>;set(v:Record<string,string>):void}) {
  return <fieldset><legend>{title} · opcional 0–10</legend><div className={styles.grid}>{STATE_FIELDS.map(k=><label key={k}>{title} {labels[k]}<select value={value[k]??''} onChange={e=>set({...value,[k]:e.target.value})}><option value="">Sin registrar</option>{Array.from({length:11},(_,n)=><option key={n} value={n}>{n}</option>)}</select></label>)}</div></fieldset>;
}
export default function PersonalizedAdvisor({active,onConfirm,onStop}:{active:boolean;onConfirm(request:DiscoveryPlaybackRequest):Promise<void>;onStop():void}) {
  const [plans,setPlans]=useState<ProtocolDiscoveryPlanV1[]>([]), [anchor,setAnchor]=useState(''), [contextIndex,setContextIndex]=useState(0);
  const [recommendation,setRecommendation]=useState<PersonalizedRecommendationSetV1|null>(null), [chosen,setChosen]=useState('');
  const [expectation,setExpectation]=useState(''), [pre,setPre]=useState<Record<string,string>>({}), [post,setPost]=useState<Record<string,string>>({});
  const [reflection,setReflection]=useState(''), [consent,setConsent]=useState(false), [error,setError]=useState(''), [working,setWorking]=useState(false);
  const [record,setRecord]=useState<PersonalizedExperimentV1|null>(null), [history,setHistory]=useState<PersonalizedExperimentV1[]>([]);
  const live=useRef<PersonalizedExperimentV1|null>(null), mounted=useRef(false);
  const plan=plans.find(p=>p.id===anchor);
  const contexts:DiscoveryContextV1[]=[];
  for(const p of plans) if(plan && p.status==='completed' && same(p.intent,plan.intent) && same(p.candidates,plan.candidates) && p.primaryMetric===plan.primaryMetric && same(p.comparabilityPolicy,plan.comparabilityPolicy)) {
    for(const a of p.assignments) if(a.result && !contexts.some(c=>contextKey(c)===contextKey(a.result!.context))) contexts.push(a.result.context);
  }
  if(!contexts.length) contexts.push({});
  const context=contexts[contextIndex]??contexts[0];
  const selected=recommendation?.recommendations.find(r=>r.candidateId===chosen);
  const blocked=active||working||!!record;
  useEffect(()=>{
    mounted.current=true;
    return ()=>{mounted.current=false;};
  },[]);
  async function run(operation:()=>Promise<void>) {
    if(working)return; setWorking(true); setError('');
    try { await operation(); } catch(e) { if(mounted.current)setError((e as Error).message); }
    finally { if(mounted.current)setWorking(false); }
  }
  function invalidate() { setRecommendation(null); setChosen(''); }
  return <details><summary>Personalización · evidencia personal</summary><section aria-label="Asesor personalizado">
    <h2>Personalización desde Protocol Discovery</h2>
    <p>Elige una intención ya registrada en un plan completado. Solo se ordenan sus candidatos válidos; el calendario Discovery permanece fijo.</p>
    <p>N &lt; 5: NONE · N 5–9: PRELIMINARY · N ≥ 10: DESCRIPTIVE. Estos umbrales son reglas del producto, no prueba científica. Todas las opciones siguen disponibles.</p>
    {error&&<p role="alert">{error}</p>}
    <button disabled={blocked} onClick={()=>void run(async()=>{
      invalidate(); const rows=await new DiscoveryStore(localStorage).load(); setPlans(rows); setAnchor(''); setContextIndex(0);
      setHistory(await new PersonalizedExperimentStore(localStorage).load());
    })}>Cargar evidencia personal</button>
    <button onClick={()=>{try { download(localStorage.getItem(PERSONALIZED_EXPERIMENTS_KEY)??'null','personalized-original.json'); } catch(e) { setError((e as Error).message); }}}>Exportar historial personalizado original</button>
    <fieldset disabled={blocked}><legend>Intención y contexto registrados</legend>
      <label>Intención registrada<select value={anchor} onChange={e=>{setAnchor(e.target.value);setContextIndex(0);invalidate();}}><option value="">Selecciona un plan completado</option>{plans.filter(p=>p.status==='completed').map(p=><option key={p.id} value={p.id}>{p.intent.intent.intention} · {p.id}</option>)}</select></label>
      {plan&&<><label>Contexto personal comparable<select value={contextIndex} onChange={e=>{setContextIndex(Number(e.target.value));invalidate();}}>{contexts.map((c,i)=><option key={contextKey(c)} value={i}>{Object.keys(c).length?JSON.stringify(c):'Contexto no registrado'}</option>)}</select></label>
      <button onClick={()=>void run(async()=>{
        const fresh=await new DiscoveryStore(localStorage).load();
        const value=await personalize(fresh,anchor,context); setPlans(fresh); setRecommendation(value); setChosen('');
      })}>Generar recomendaciones personales</button></>}
    </fieldset>
    {recommendation&&<section aria-label="Ranking personal"><h3>{recommendation.intent.intent.intention}</h3>
      <p>Estado: {recommendation.evidenceLevel} · {reasons[recommendation.reason]}</p>
      <p>Métrica: {labels[recommendation.targetMetric]} · {recommendation.targetMetric==='tension'?'Menor es favorable':'Mayor es favorable'} · Diferencia de expectativa media: {recommendation.expectationDifference??'Sin datos'} / 10.</p>
      <p>Solo observaciones completas del mismo contexto registrado. Un contexto ausente no demuestra igualdad de condiciones. Expectativa y estado previo no están controlados; no se infiere causalidad.</p>
      {recommendation.recommendations.map((r,index)=><article key={r.candidateId} aria-label={`Candidato personal ${r.candidateId}`}>
        <h4>{r.candidate.label} · {recommendation.orderingApplied&&index===0?'Recomendado para ti':recommendation.orderingApplied?'Otra opción válida':'Orden original'}</h4>
        <p>Regla: {r.candidate.ruleId??`Constelación ${r.candidate.constellation?.generationVersion}`} · Matemática validada · Compatible con reproducción V1.</p>
        <p>N = {r.comparableN} sesiones comparables · {r.evidenceLevel} · Score: {r.personalizationScore}</p>
        <ProtocolRationale value={r.candidate.rationale} config={r.candidate.config} constellation={r.candidate.constellation}><section aria-label={`Por qué se priorizó ${r.candidateId}`}>
          <h4>Por qué se priorizó para ti</h4>
          <p>{recommendation.orderingApplied&&index===0?'Este candidato tiene la mayor señal descriptiva registrada (los empates conservan el orden original).':reasons[recommendation.reason]}</p>
          <p>Métrica: {labels[r.targetMetric]} · N = {r.comparableN} · Evidencia: {r.evidenceLevel}.</p>
          <p>Cambio después − antes: media {r.descriptiveMetrics.change.mean??'Sin datos'} · mediana {r.descriptiveMetrics.change.median??'Sin datos'} · rango {r.descriptiveMetrics.change.min??'—'} a {r.descriptiveMetrics.change.max??'—'}.</p>
          <p>Consistencia: {r.terms.improvingSessions}/{r.comparableN} cambios favorables. Estado previo medio: {r.descriptiveMetrics.baseline.mean??'Sin datos'}.</p>
          <p>Expectativa media: {r.descriptiveMetrics.expectation.mean??'Sin datos'} · rango {r.descriptiveMetrics.expectation.min??'—'} a {r.descriptiveMetrics.expectation.max??'—'}. {recommendation.expectationConfound?'Posible confusión por expectativas diferentes.':'La expectativa sigue siendo un posible factor de confusión.'}</p>
          <p>Score = señal {r.terms.outcomeSignal} × peso N {r.terms.evidenceWeight} × consistencia {r.terms.consistencyWeight} = {r.personalizationScore}. Algoritmo: {r.algorithmVersion}.</p>
          <details><summary>Procedencia exacta · {r.candidateId}</summary><pre>{JSON.stringify(r,null,2)}</pre></details>
        </section></ProtocolRationale>
        <button disabled={blocked} onClick={()=>{setChosen(r.candidateId);setExpectation('');setPre({});setPost({});setReflection('');setConsent(false);}}>Elegir {r.candidate.label} · vista previa</button>
      </article>)}
      <StructuralAnalysis evidence={recommendation}/>
      <button onClick={()=>download(JSON.stringify(recommendation,null,2),'personalization-recommendation.json')}>Exportar recomendación y evidencia</button>
    </section>}
    {selected&&recommendation&&!record&&<section aria-label="Vista previa personalizada"><h3>Confirmar {selected.candidate.label}</h3>
      <SessionPlan config={selected.candidate.config} schedule={buildSchedule(selected.candidate.config)}/>
      <p>Contexto confirmado: {JSON.stringify(recommendation.context)}. La sesión se registra por separado y no cambia ni alimenta automáticamente Discovery.</p>
      <fieldset disabled={active||working}>
        <label>Expectativa personal (0–10, requerida)<select value={expectation} onChange={e=>setExpectation(e.target.value)}><option value="">Sin registrar</option>{Array.from({length:11},(_,n)=><option key={n} value={n}>{n}</option>)}</select></label>
        <Ratings title="Antes personal" value={pre} set={setPre}/>
        {selected.candidate.config.ratioId==='cascade-13-12'&&<label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>Acepto la cascada experimental personalizada</label>}
        <button disabled={expectation===''||(selected.candidate.config.ratioId==='cascade-13-12'&&!consent)} onClick={()=>void onConfirm({
          prepare:async()=>{
            const original=localStorage.getItem(DISCOVERY_KEY);
            const fresh=await personalize(await new DiscoveryStore(localStorage).load(),recommendation.anchorPlanId,recommendation.context);
            if(!same(fresh,recommendation))throw new Error('La evidencia cambió. Genera otra recomendación y vista previa.');
            if(expectation==='')throw new Error('Registra la expectativa.');
            const c=fresh.recommendations.find(r=>r.candidateId===chosen)!.candidate;
            const experiment=await prepareExperimentV2(c.config,{intention:fresh.intent.intent.intention,expectationScore:Number(expectation),context:JSON.stringify(fresh.context),preState:stateInput(pre)},c.constellation);
            if(localStorage.getItem(DISCOVERY_KEY)!==original)throw new Error('La evidencia cambió durante la confirmación. Genera otra vista previa.');
            live.current={schemaVersion:1,recommendation:fresh,selectedCandidateId:chosen,experiment};
            if(mounted.current)setRecord(live.current); return c.config;
          },
          started:()=>{if(live.current){live.current={...live.current,experiment:transitionExperimentV2(live.current.experiment,'started')};if(mounted.current)setRecord(live.current);}},
          finished:(status,notify=true)=>{if(live.current){live.current={...live.current,experiment:transitionExperimentV2(live.current.experiment,status)};if(notify&&mounted.current)setRecord(live.current);}},
        })}>Confirmar y escuchar opción personal</button>
      </fieldset>
    </section>}
    {record&&<section aria-label="Resultado personalizado"><h3>Sesión personal: {record.experiment.status} · sin guardar</h3>
      {active?<button onClick={onStop}>Detener sesión personal</button>:<fieldset disabled={working}>
        <Ratings title="Después personal" value={post} set={setPost}/><label>Reflexión personal<textarea maxLength={2000} value={reflection} onChange={e=>setReflection(e.target.value)}/></label>
        <button onClick={()=>void run(async()=>{
          if(!live.current)throw new Error('Sin borrador.');
          const value={...live.current,experiment:{...live.current.experiment,postState:stateInput(post),...(reflection.trim()?{reflection}:{})}};
          setHistory(await new PersonalizedExperimentStore(localStorage).save(value)); live.current=null; setRecord(null); setChosen('');
        })}>Guardar experimento personal</button>
        <button onClick={()=>download(JSON.stringify({...record,experiment:{...record.experiment,postState:stateInput(post),...(reflection.trim()?{reflection}:{})}},null,2),'personalized-unsaved.json')}>Exportar borrador personal</button>
      </fieldset>}
      <p>Guardar es explícito. Salir descarta el borrador; no se guarda ni se marca completado automáticamente.</p>
    </section>}
    <details><summary>Experimentos personales guardados ({history.length})</summary>{history.map(r=><article key={r.experiment.id}><h4>{r.experiment.id} · {r.experiment.status}</h4><p>Candidato: {r.selectedCandidateId} · {r.recommendation.algorithmVersion}</p><button onClick={()=>download(JSON.stringify(r,null,2),`personalized-${r.experiment.id}.json`)}>Exportar experimento personal {r.experiment.id}</button><details><summary>Auditoría completa</summary><pre>{JSON.stringify(r,null,2)}</pre></details></article>)}</details>
  </section></details>;
}
