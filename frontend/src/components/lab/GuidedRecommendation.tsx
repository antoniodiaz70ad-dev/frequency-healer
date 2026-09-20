'use client';
import { useEffect, useState } from 'react';
import { interpretGuidedIntent, recommendGuided, type GuidedInterpretationV1, type GuidedRecommendationV1 } from '@/lib/guided/recommendations';
import { GOALS, type VoiceGoal } from '@/lib/voice/types';
import { dictionaries } from '@/lib/voice/i18n';
import { VoiceStore, SESSIONS_KEY } from '@/lib/voice/storage';
import ProtocolRationale from './ProtocolRationale';
import SessionPlan from '../voice/SessionPlan';
import styles from '../voice/voice.module.css';
const levels={none:'Evidencia personal insuficiente',insufficient:'Evidencia personal insuficiente',preliminary:'Señal personal preliminar',descriptive:'Patrón personal descriptivo'};
export default function GuidedRecommendation({active,onConfirm,onStop}:{active:boolean;onConfirm(value:GuidedRecommendationV1,consent:boolean):Promise<void>;onStop():void}) {
  const [words,setWords]=useState(''),[interpretation,setInterpretation]=useState<GuidedInterpretationV1|null>(null);
  const [recommendation,setRecommendation]=useState<GuidedRecommendationV1|null>(null),[volume,setVolume]=useState<number|undefined>();
  const [error,setError]=useState(''),[historyError,setHistoryError]=useState(''),[consent,setConsent]=useState(false);
  useEffect(()=>{
    const changed=(event:StorageEvent)=>{if(event.key===SESSIONS_KEY||event.key===null){setRecommendation(null);setConsent(false);setHistoryError('El historial cambió. Genera otra propuesta para actualizar la evidencia.');}};
    window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);
  },[]);
  function revise(next:GuidedInterpretationV1){setInterpretation(next);setRecommendation(null);setConsent(false);setError('');}
  return <section aria-label="Guía por intención"><h2>¿Qué quieres explorar hoy?</h2>
    <p>Describe una intención. Revisarás la interpretación y una propuesta antes de escuchar. No necesitas elegir frecuencias.</p>
    <fieldset disabled={active}>
      <label>Tu intención de exploración<textarea maxLength={500} value={words} onChange={e=>{setWords(e.target.value);setInterpretation(null);setRecommendation(null);setConsent(false);setError('');}} placeholder="Quiero sentirme más centrado después de una reunión."/></label>
      <p>Por ejemplo: calma, concentrarme, preparar el descanso, recuperarme, meditar o explorar creatividad.</p>
      <button onClick={()=>{try{setError('');setVolume(undefined);setConsent(false);setRecommendation(null);setInterpretation(interpretGuidedIntent(words));}catch(e){setInterpretation(null);setRecommendation(null);setError((e as Error).message);}}}>Interpretar intención</button>
      {interpretation&&<div><h3>Revisa la interpretación</h3><p>{interpretation.explanation}</p>
        <label>Objetivo interpretado<select value={interpretation.intent.goal} onChange={e=>revise({...interpretation,intent:{...interpretation.intent,goal:e.target.value as VoiceGoal,desiredStates:[],confidence:{...interpretation.intent.confidence,goal:1},requiresReview:[]},explanation:'Objetivo corregido explícitamente por ti; estados específicos sin inferir.'})}>{GOALS.map(goal=><option value={goal} key={goal}>{dictionaries.es.goals[goal]}</option>)}</select></label>
        <p>Estados propuestos: {interpretation.intent.desiredStates.map(state=>dictionaries.es.states[state]).join(', ')||'Sin especificar'}. La confianza corresponde a clasificación, no a efectos biológicos.</p>
        <div className={styles.grid}>
          <label>Duración de la guía (minutos)<input type="number" min={5} max={60} step={1} value={interpretation.intent.durationMinutes} onChange={e=>revise({...interpretation,intent:{...interpretation.intent,durationMinutes:Number(e.target.value)}})}/></label>
          <label>Diseño de la guía<select value={interpretation.intent.intensity} onChange={e=>revise({...interpretation,intent:{...interpretation.intent,intensity:e.target.value as 'gentle'|'deep'|'experimental'}})}><option value="gentle">Suave</option><option value="deep">Profundo</option><option value="experimental">Experimental</option></select></label>
          <label>Volumen de la guía (0–100)<input type="number" min={0} max={100} value={volume??(interpretation.intent.intensity==='gentle'||interpretation.intent.goal==='sleep_preparation'?15:20)} onChange={e=>{setVolume(Number(e.target.value));setRecommendation(null);setConsent(false);}}/></label>
        </div>
        <button onClick={()=>{setInterpretation(null);setRecommendation(null);setConsent(false);}}>No era lo que quería decir · editar texto</button>
        <button onClick={()=>{
          setError('');setConsent(false);setRecommendation(null);let records=null;
          try{records=new VoiceStore(localStorage).load();setHistoryError('');}catch(e){setHistoryError((e as Error).message);}
          try{setRecommendation(recommendGuided(interpretation,records,volume));}catch(e){setError((e as Error).message);}
        }}>Revisé mi intención · generar recomendación</button>
      </div>}
    </fieldset>
    {error&&<p role="alert">{error}</p>}
    {historyError&&<p role="status">{historyError} No se escribe ni repara el historial.</p>}
    {recommendation&&<div aria-label="Recomendación guiada"><h3>Una exploración para revisar</h3>
      <p>{dictionaries.es.goals[recommendation.proposal.intent.goal]} · {recommendation.proposal.intent.durationMinutes} minutos · volumen {recommendation.proposal.harmonicConfig.uiVolume}/100.</p>
      <p>{recommendation.proposal.rationale[0]}</p>
      <ProtocolRationale value={recommendation.rule.rationale}/>
      <details><summary>¿Por qué esta propuesta?</summary>
        <p>Tu intención: {recommendation.interpretation.rawText}</p>
        <p>Interpretación: {dictionaries.es.goals[recommendation.proposal.intent.goal]}. {recommendation.interpretation.explanation}</p>
        <p>Mapeo: {recommendation.interpretation.taxonomyVersion}. Regla: {recommendation.proposal.ruleId} · {recommendation.proposal.ruleVersion}.</p>
        {recommendation.explanation.map(line=><p key={line}>{line}</p>)}
      </details>
      <details><summary>Detalles armónicos de la guía</summary><SessionPlan config={recommendation.proposal.harmonicConfig} schedule={recommendation.proposal.schedule}/>
        <p>Frecuencias exactas sin redondeo: {recommendation.proposal.schedule.steps.flatMap(step=>step.frequencies).join(', ')} Hz.</p>
        <p>Arquitectura V1 existente; no se inventa una constelación ni una firma.</p>
      </details>
      <h3>Tu evidencia personal · Personal N=1</h3><p>{recommendation.personalEvidence.available?`Sesiones comparables: ${recommendation.personalEvidence.comparableSessions} · ${levels[recommendation.personalEvidence.evidenceLevel]}`:'Evidencia no disponible; no se presume N=0.'}</p>
      <details><summary>Cómo se compara tu historial</summary><p>{recommendation.personalEvidence.explanation}</p></details>
      {recommendation.personalEvidence.metrics.map(metric=><p key={metric.metric}>En tus sesiones comparables, esta configuración se asoció con un cambio medio de {metric.mean} en {({clarity:'claridad',stress:'tensión percibida',focus:'enfoque'})[metric.metric]} (después − antes; N={metric.n}). {metric.label}. No demuestra causalidad.</p>)}
      <p>La selección sigue las reglas, sin priorizar resultados personales. La ausencia de registros no es una valoración negativa.</p>
      <h3>Antes de confirmar</h3><p>Intención revisada · interpretación confirmada · reproducción compatible · configuración validada · duración {recommendation.proposal.intent.durationMinutes} minutos · volumen {recommendation.proposal.harmonicConfig.uiVolume}/100 · {recommendation.personalEvidence.available?levels[recommendation.personalEvidence.evidenceLevel]:'evidencia no disponible'}.</p>
      <p>Empieza con volumen cómodo. No conduzcas ni manejes maquinaria. Detente si aparece incomodidad, dolor, mareo o síntomas inusuales. No se requieren auriculares para este diseño. Al ocultar la pestaña, el audio se detiene.</p>
      <p>Exploración personal, sin promesas médicas; no sustituye una evaluación profesional si describes síntomas de salud. El registro experimental opcional de abajo conserva la configuración acústica; la explicación se exporta por separado y no se guarda automáticamente.</p>
      {recommendation.proposal.requiresExplicitExperimentalConsent&&<label className={styles.check}><input type="checkbox" checked={consent} disabled={active} onChange={e=>setConsent(e.target.checked)}/>Acepto la cascada experimental de la guía, sin promesas de resultados.</label>}
      <button className={styles.primary} disabled={active||(recommendation.proposal.requiresExplicitExperimentalConsent&&!consent)} onClick={()=>void onConfirm(recommendation,consent)}>Confirmar y escuchar propuesta</button>
      <button disabled={active} onClick={()=>{setRecommendation(null);setConsent(false);}}>Corregir interpretación</button>
      <button onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(recommendation,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='recomendacion-guiada-v1.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Exportar propuesta y explicación</button>
    </div>}
    {active&&<button className={styles.stop} onClick={onStop}>Detener audio del laboratorio</button>}
  </section>;
}
