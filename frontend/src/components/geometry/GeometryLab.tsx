'use client';
import { useId, useState } from 'react';
import { GEOMETRY_PRESETS, cloneGeometryConfig } from '@/lib/geometry/presets';
import { geometrySignature } from '@/lib/geometry/math';
import { renderGeometrySvg } from '@/lib/geometry/export';
import { starCycleCount, starKind } from '@/lib/geometry/validation';
import type { GeometryConfig, GeometryFamily } from '@/lib/geometry/types';
import GeometrySvg from './GeometrySvg';
import styles from './geometry.module.css';

const FAMILY_LABELS:Record<GeometryFamily,string>={
  'star-polygon':'Estrella geométrica','orbital-circles':'Círculos orbitales','radial-wheel':'Rueda radial',lissajous:'Curva Lissajous',polar:'Geometría polar',
};
const saveBlob=(blob:Blob,name:string)=>{const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),0);};

export default function GeometryLab({audioPlaying,onListenReference,onStopAudio}:{audioPlaying:boolean;onListenReference:(frequencyHz:number)=>Promise<void>;onStopAudio:()=>void}){
  const titleId=useId();
  const [presetId,setPresetId]=useState(GEOMETRY_PRESETS[0].id);
  const [config,setConfig]=useState<GeometryConfig>(()=>cloneGeometryConfig(GEOMETRY_PRESETS[0]));
  const [comparison,setComparison]=useState<GeometryConfig|null>(null);
  const original=GEOMETRY_PRESETS.find(row=>row.id===presetId)??GEOMETRY_PRESETS[0];
  const patch=(value:Partial<GeometryConfig>)=>setConfig(current=>({...current,...value}));
  const selectPreset=(id:string)=>{const next=GEOMETRY_PRESETS.find(row=>row.id===id);if(next){setPresetId(id);setConfig(cloneGeometryConfig(next));}};
  const reset=()=>setConfig(cloneGeometryConfig(original));
  const exportSvg=()=>saveBlob(new Blob([renderGeometrySvg(config)],{type:'image/svg+xml'}),`${config.id}.svg`);
  const exportPng=()=>{const svg=renderGeometrySvg(config),image=new Image(),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1200;const context=canvas.getContext('2d');if(context){context.drawImage(image,0,0,1200,1200);canvas.toBlob(blob=>{if(blob)saveBlob(blob,`${config.id}.png`);},'image/png');}URL.revokeObjectURL(url);};image.src=url;};
  const cycleDescription=config.family==='star-polygon'?starKind(config.vertices,config.step)==='single-cycle'?'Ciclo único':`Compuesta · ${starCycleCount(config.vertices,config.step)} ciclos`:null;
  return <section className={styles.lab} aria-labelledby={titleId}>
    <header className={styles.header}><div><p className={styles.kicker}>GEOMETRÍA ARTÍSTICA · MOTOR INDEPENDIENTE</p><h2 id={titleId}>Resonance Geometry Lab</h2><p>Construcciones matemáticas generativas. La frecuencia acústica es una referencia independiente y no demuestra que el sonido produzca esta figura.</p></div><span className={styles.badge}>ARTISTIC GEOMETRY</span></header>
    <div className={styles.presetRail} aria-label="Presets geométricos">{GEOMETRY_PRESETS.map(row=><button key={row.id} aria-pressed={presetId===row.id} onClick={()=>selectPreset(row.id)}><span>{row.acousticFrequencyHz} Hz</span><small>{row.name}</small></button>)}</div>
    <div className={styles.stage}>
      <div className={styles.preview}><GeometrySvg config={config}/><div className={styles.caption}><strong>{config.name}</strong><span>{FAMILY_LABELS[config.family]}</span></div></div>
      <div className={styles.controls}>
        <label>Familia<select value={config.family} onChange={event=>patch({family:event.target.value as GeometryFamily})}>{Object.entries(FAMILY_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <div className={styles.split}><label>Vértices<input type="number" min="3" max="72" value={config.vertices} onChange={event=>patch({vertices:Math.max(3,Math.min(72,Number(event.target.value)))})}/></label><label>Paso k<input type="number" min="1" max={Math.max(1,config.vertices-1)} value={config.step} onChange={event=>patch({step:Math.max(1,Math.min(config.vertices-1,Number(event.target.value)))})}/></label></div>
        {cycleDescription&&<p className={styles.helper}>{cycleDescription}. Los polígonos compuestos se conservan como varios ciclos; no se fuerzan a ser coprimos.</p>}
        <label>Simetría <output>{config.symmetry}</output><input type="range" min="1" max="36" step="1" value={config.symmetry} onInput={event=>patch({symmetry:Number(event.currentTarget.value)})}/></label>
        <label>Rotación <output>{config.rotationDeg}°</output><input type="range" min="-180" max="180" step="1" value={config.rotationDeg} onInput={event=>patch({rotationDeg:Number(event.currentTarget.value)})}/></label>
        <label>Fase <output>{config.phase.toFixed(2)}</output><input type="range" min="0" max="1" step=".01" value={config.phase} onInput={event=>patch({phase:Number(event.currentTarget.value)})}/></label>
        <label>Escala <output>{Math.round(config.scale*100)}%</output><input type="range" min=".35" max="1" step=".01" value={config.scale} onInput={event=>patch({scale:Number(event.currentTarget.value)})}/></label>
        <label>Color<input className={styles.color} type="color" value={config.color} onChange={event=>patch({color:event.target.value})}/></label>
        <div className={styles.acoustic}><span>VARIABLE ACÚSTICA SEPARADA</span><label>Frecuencia de referencia<input type="number" min=".1" max="20000" step=".01" value={config.acousticFrequencyHz} onChange={event=>{const value=Number(event.target.value);if(Number.isFinite(value)&&value>=.1&&value<=20000)patch({acousticFrequencyHz:value});}}/> Hz</label><small>Cambiarla no altera automáticamente la geometría ni inicia audio. El motor audible admite referencias entre 0.1 y 2000 Hz.</small><div className={styles.listenActions}>{audioPlaying?<button onClick={onStopAudio}>Detener frecuencia</button>:<button disabled={config.acousticFrequencyHz>2000} onClick={()=>void onListenReference(config.acousticFrequencyHz)}>Escuchar {config.acousticFrequencyHz.toFixed(2)} Hz</button>}</div></div>
        <div className={styles.actions}><button onClick={reset}>Restablecer preset</button><button onClick={()=>setComparison(cloneGeometryConfig(config))}>Guardar como A</button><button onClick={exportSvg}>Exportar SVG</button><button onClick={exportPng}>Exportar PNG</button></div>
      </div>
    </div>
    {comparison&&<section className={styles.compare}><div className={styles.compareHeader}><div><p className={styles.kicker}>COMPARACIÓN VISUAL</p><h3>A / B</h3></div><button onClick={()=>setComparison(null)}>Cerrar comparación</button></div><div className={styles.compareGrid}><figure><GeometrySvg config={comparison} label="Configuración A"/><figcaption>A · {comparison.name} · {comparison.acousticFrequencyHz.toFixed(2)} Hz</figcaption></figure><figure><GeometrySvg config={config} label="Configuración B"/><figcaption>B · configuración actual · {config.acousticFrequencyHz.toFixed(2)} Hz</figcaption></figure></div><p className={styles.signature}>A: {geometrySignature(comparison)}<br/>B: {geometrySignature(config)}</p></section>}
  </section>;
}
