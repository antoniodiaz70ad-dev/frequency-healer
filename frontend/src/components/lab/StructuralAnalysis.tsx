'use client';
import { useEffect, useState } from 'react';
import type { PersonalizedRecommendationSetV1 } from '@/lib/personalization/ranking';
import { analyzeStructure, STRUCTURAL_GROUPS, type StructuralGroupBy, type StructuralAnalysisV1 } from '@/lib/harmonic/profile/analysis';
import { HCI_DISCLAIMER } from './StructureProfile';
const labels={hciBand:'Banda HCI',memberCount:'Número de miembros',uniqueFrequencyCount:'Frecuencias únicas',ratioDiversity:'Diversidad de ratios',octaveSpan:'Amplitud en octavas',spectralSpanHz:'Amplitud espectral (Hz)',playbackMode:'Modo de reproducción'};
export default function StructuralAnalysis({evidence}:{evidence:PersonalizedRecommendationSetV1}) {
  const [open,setOpen]=useState(false),[groupBy,setGroupBy]=useState<StructuralGroupBy>('hciBand');
  const [result,setResult]=useState<{key:string;value?:StructuralAnalysisV1;error?:string}|null>(null);
  const key=JSON.stringify({evidence,groupBy});
  useEffect(()=>{
    if(!open)return;let current=true;const input=JSON.parse(key);
    void analyzeStructure(input.evidence,input.groupBy).then(value=>{if(current)setResult({key,value});},e=>{if(current)setResult({key,error:(e as Error).message});});
    return ()=>{current=false;};
  },[key,open]);
  const report=result?.key===key?result.value:undefined;
  return <details onToggle={e=>setOpen(e.currentTarget.open)}><summary>Análisis estructural N=1 · avanzado</summary><section aria-label="Análisis estructural N=1">
    <p>{HCI_DISCLAIMER} Esta dimensión no modifica el ranking personal.</p>
    <p>Solo evidencia elegible de la intención y el contexto elegidos. Semilla, duración, volumen, modo y onda permanecen separados; no se agrupan para atribuir un resultado al HCI. Otras diferencias estructurales, estado previo y expectativas pueden influir.</p>
    <label>Agrupar estructura por<select value={groupBy} onChange={e=>setGroupBy(e.target.value as StructuralGroupBy)}>{STRUCTURAL_GROUPS.map(k=><option key={k} value={k}>{labels[k]}</option>)}</select></label>
    {report?<><p>Intención: {report.evidence.intent.intent.intention} · Métrica: {report.evidence.targetMetric} · Contexto: {JSON.stringify(report.evidence.context)}.</p>
      <p>{report.profileVersion} · {report.algorithmVersion}. N cuenta pares completos de sesiones completadas; no incluye canceladas ni interrumpidas. No hay ajuste causal.</p>
      {report.groups.map((g,i)=><article key={i} aria-label={`Grupo estructural ${i+1}`}><h4>{labels[report.groupBy]}: {g.value}</h4>
        <p>Semilla {g.stratum.seedFrequencyHz} Hz · Duración {g.stratum.durationSeconds} s · Volumen {g.stratum.uiVolume}/100 · {g.stratum.playbackMode} · {g.stratum.waveform}.</p>
        <p>Candidatos: {g.candidateIds.join(', ')} · N = {g.comparableN} · {g.evidenceLevel}.</p>
        <p>Expectativa media: {g.expectation.mean??'Sin datos'} · rango {g.expectation.min??'—'}–{g.expectation.max??'—'}. Estado previo medio: {g.baseline.mean??'Sin datos'} · rango {g.baseline.min??'—'}–{g.baseline.max??'—'}.</p>
        {g.comparableN<10?<p>Insufficient comparable sessions. Se requieren al menos 10 pares comparables para mostrar una asociación.</p>:g.expectationConfound?<p>Expectativas diferentes entre candidatos (brecha {g.expectationDifference}/10). No se presenta una asociación estructural.</p>:<p>En estas {g.comparableN} sesiones comparables del grupo {String(g.value)}, el cambio registrado de {report.evidence.targetMetric} fue: media {g.change.mean}, mediana {g.change.median}, rango {g.change.min}–{g.change.max} (después − antes). Es una asociación descriptiva del grupo completo; no un efecto aislado de su estructura ni una conclusión causal.</p>}
        <p>{report.evidence.targetMetric==='tension'?'En tensión, un cambio negativo significa menor puntuación registrada.':'Un cambio positivo significa mayor puntuación registrada.'} Una única estructura no permite comparar niveles de complejidad.</p>
        <details><summary>Procedencia del grupo {i+1}</summary><pre>{JSON.stringify(g.observations,null,2)}</pre></details>
      </article>)}
      <button onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='harmonic-structure-analysis-v1.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Exportar análisis estructural</button>
      <p>Recalculado bajo las versiones indicadas. No se guardan copias HIP/HCI en los registros ni se modifica su contenido.</p>
    </>:<p role="status">{result?.key===key&&result.error?`Análisis no disponible: ${result.error}`:'Calculando análisis estructural…'}</p>}
  </section></details>;
}
