'use client';
import { useEffect, useState } from 'react';
import type { HarmonicConfig } from '@/lib/harmonic/math';
import type { HarmonicConstellationV1 } from '@/lib/harmonic/constellations';
import { describeHarmonics, type HarmonicStructureV1 } from '@/lib/harmonic/profile/profile';

export const HCI_DISCLAIMER='HCI describe solo complejidad estructural. No mide fuerza terapéutica ni eficacia.';
const bands={lower:'menor complejidad estructural',moderate:'complejidad estructural intermedia',higher:'mayor complejidad estructural'};
export default function StructureProfile({config,constellation,label='Perfil estructural'}:{config:HarmonicConfig;constellation?:HarmonicConstellationV1;label?:string}) {
  const [open,setOpen]=useState(false),[result,setResult]=useState<{key:string;value?:HarmonicStructureV1;error?:string}|null>(null);
  const key=JSON.stringify(constellation?{sourceType:'harmonic-constellation',constellation}:{sourceType:'legacy-harmonic-config',configuration:config});
  useEffect(()=>{
    if(!open)return;let current=true;
    void describeHarmonics(JSON.parse(key)).then(value=>{if(current)setResult({key,value});},e=>{if(current)setResult({key,error:(e as Error).message});});
    return ()=>{current=false;};
  },[key,open]);
  const value=result?.key===key?result.value:undefined;
  return <details onToggle={e=>setOpen(e.currentTarget.open)}><summary>{label}</summary><section aria-label={label}>
    <p>{HCI_DISCLAIMER}</p><p>Descripción derivada; no modifica esta configuración ni su reproducción.</p>
    {value?<><p>HCI: {value.hci.score} / 100 · {bands[value.hci.band]} · {value.hci.algorithmVersion}</p>
      <p>Fuente: {value.hip.sourceType} · generación {value.hip.generationVersion} · {value.hip.profileVersion}.</p>
      <p>Semilla: {value.hip.seedFrequencyHz} Hz · Miembros: {value.hip.memberCount} · Miembros únicos: {value.hip.uniqueMemberCount} · Frecuencias únicas: {value.hip.uniqueFrequencyCount}.</p>
      <p>Ratios declarados: {value.hip.ratioCount} · Diversidad de ratios: {value.hip.ratioDiversity} · Familias: {value.hip.ratioFamilies.join(', ')||'Ninguna declarada'} · Relaciones únicas: {value.hip.uniqueRelationshipCount}.</p>
      <p>Amplitud en octavas log₂(máx/mín): {value.hip.octaveSpan} · Octavas explícitas: {value.hip.octaveOffsets.join(', ')||'No declaradas'} · Amplitud de offsets explícitos: {value.hip.explicitOctaveOffsetSpan??'No registrada'}.</p>
      <p>Espectro: {value.hip.spectralMinHz}–{value.hip.spectralMaxHz} Hz · Amplitud espectral: {value.hip.spectralSpanHz} Hz.</p>
      <p>Modo: {value.hip.playbackMode} · Orden significativo: {value.hip.orderedStructure?'sí':'no'} · Repeticiones de frecuencia: {value.hip.duplicateVoiceCount} {value.hip.playbackMode==='sequence'?'(ocurrencias sucesivas, no voces concurrentes)':'(voces simultáneas)'}.</p>
      <p>HCI = 25 × (miembros {value.hci.terms.member} + relaciones {value.hci.terms.relationship} + espectro {value.hci.terms.spectral} + orden {value.hci.terms.order}). Bandas: [0, 100/3), [100/3, 200/3), [200/3, 100]. No son umbrales de resultados.</p>
      <details><summary>Miembros y multiplicidad exactos</summary><pre>{JSON.stringify(value.hip.members,null,2)}</pre><pre>{JSON.stringify(value.hip.frequencyMultiplicity,null,2)}</pre></details>
    </>:<p role="status">{result?.key===key&&result.error?`Perfil no disponible: ${result.error}`:'Calculando perfil estructural…'}</p>}
  </section></details>;
}
