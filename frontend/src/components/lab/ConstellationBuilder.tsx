'use client';
import { useEffect, useRef, useState } from 'react';
import { compileConstellation, type ConstellationInputV1, type HarmonicConstellationV1, type HarmonicRelationshipV1 } from '@/lib/harmonic/constellations';
import { assessBuilderPlayability, moveBuilderMember, type BuilderPlayability } from '@/lib/harmonic/builder';
import { ConstellationStore, CONSTELLATIONS_KEY } from '@/lib/harmonic/constellationStorage';
import type { HarmonicConfig } from '@/lib/harmonic/math';
import styles from './ConstellationBuilder.module.css';
const ratios = ['1:1','5:4','6:5','4:3','3:2','5:3','2:1'];
const labels = { compatible: 'Compatible con estructura de reproducción V1', partial: 'Parcialmente compatible', 'builder-only': 'Solo Builder' };
const newDraft = (): ConstellationInputV1 => ({id:crypto.randomUUID(),seedFrequencyHz:432,playbackMode:'sequence',members:[]});
function exportJSON(value: string, name: string) {
  const url=URL.createObjectURL(new Blob([value],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
interface BuilderProps { context: HarmonicConfig; playbackActive?: boolean; onPreviewPlayback?(record: HarmonicConstellationV1): void }
function Builder({ context, playbackActive, onPreviewPlayback }: BuilderProps) {
  const [draft,setDraft]=useState(newDraft);
  const [ratio,setRatio]=useState('3:2'),[offset,setOffset]=useState('1');
  const [settled,setSettled]=useState<{source:ConstellationInputV1;context:HarmonicConfig;value?:HarmonicConstellationV1;playability?:BuilderPlayability;error?:string}>();
  const [history,setHistory]=useState<HarmonicConstellationV1[]>([]),[storageError,setStorageError]=useState('');
  const [notice,setNotice]=useState(''),[saved,setSaved]=useState(false),[saving,setSaving]=useState(false);
  const savingRef=useRef(false),historyRun=useRef(0),mounted=useRef(false);
  useEffect(()=>{
    mounted.current=true;let active=true;
    const refresh=async()=>{const run=++historyRun.current;try{const rows=await new ConstellationStore(localStorage).load();if(active&&mounted.current&&run===historyRun.current){setHistory(rows);setStorageError('');}}catch(e){if(active&&mounted.current&&run===historyRun.current){setHistory([]);setStorageError((e as Error).message);}}};
    void refresh();const changed=(e:StorageEvent)=>{if(e.key===CONSTELLATIONS_KEY||e.key===null)void refresh();};window.addEventListener('storage',changed);
    return()=>{active=false;mounted.current=false;window.removeEventListener('storage',changed);};
  },[]);
  useEffect(()=>{
    let active=true;
    void compileConstellation(draft).then(async value=>({value,playability:await assessBuilderPlayability(value,context)})).then(
      result=>{if(active)setSettled({source:draft,context,...result});},
      error=>{if(active)setSettled({source:draft,context,error:error instanceof Error?error.message:'No se pudo validar la constelación.'});},
    );
    return()=>{active=false;};
  },[draft,context]);
  const current=settled?.source===draft&&settled.context===context?settled:undefined;
  const edit=(change:Partial<ConstellationInputV1>)=>{setDraft(value=>({...value,...change}));setNotice('');};
  const add=(member:HarmonicRelationshipV1)=>edit({members:[...draft.members,member]});
  const relationship=(member:HarmonicRelationshipV1)=>member.relationshipType==='root'?'Raíz · 1:1':member.relationshipType==='ratio'?`Ratio · ${member.ratio.numerator}:${member.ratio.denominator}`:`Octava · ${member.octaveOffset>0?'+':''}${member.octaveOffset}`;
  return <div className={styles.builder}>
    <p>Construir no es reproducir. Este espacio tiene semilla y miembros independientes de los controles del laboratorio. No aplica configuraciones ni crea experimentos.</p>
    <fieldset disabled={saved||saving}>
      <div className={styles.grid}>
        <label>Semilla del Builder (Hz)<input type="number" min={40} max={2000} step="any" value={draft.seedFrequencyHz} onChange={e=>edit({seedFrequencyHz:Number(e.target.value)})}/></label>
        <label>Modo de la constelación<select value={draft.playbackMode} onChange={e=>edit({playbackMode:e.target.value as HarmonicConfig['mode']})}><option value="sequence">Secuencia</option><option value="simultaneous">Simultáneo</option></select></label>
        <label>Nombre de constelación (opcional)<input maxLength={200} value={draft.name??''} onChange={e=>edit({name:e.target.value||undefined})}/></label>
      </div>
      <p>Nombre: máximo 200 caracteres; no participa en la firma. Se conservan miembros repetidos con IDs distintos.</p>
      <button type="button" onClick={()=>add({id:crypto.randomUUID(),relationshipType:'root'})}>Añadir raíz</button>
      <div className={styles.grid}>
        <div><label>Ratio del miembro<select value={ratio} onChange={e=>setRatio(e.target.value)}>{ratios.map(r=><option key={r}>{r}</option>)}</select></label><button type="button" onClick={()=>{const [numerator,denominator]=ratio.split(':').map(Number);add({id:crypto.randomUUID(),relationshipType:'ratio',ratio:{numerator,denominator}});}}>Añadir ratio</button></div>
        <div><label>Desplazamiento del miembro de octava<input type="number" step={1} value={offset} onChange={e=>setOffset(e.target.value)}/></label><button type="button" onClick={()=>add({id:crypto.randomUUID(),relationshipType:'octave',octaveOffset:offset.trim()===''?NaN:Number(offset)})}>Añadir octava</button></div>
      </div>
      <table><caption>Miembros del borrador · sin reproducción</caption><thead><tr><th scope="col">Miembro</th><th scope="col">Relación</th><th scope="col">Frecuencia exacta</th><th scope="col">Acciones</th></tr></thead><tbody>{draft.members.map((member,index)=><tr key={member.id}>
        <th scope="row">{index+1}<small title={member.id}>ID: {member.id}</small></th><td>{relationship(member)}</td><td>{current?.value?`${current.value.members[index].frequencyHz} Hz`:'Sin resultado validado'}</td>
        <td><button type="button" aria-label={`Quitar miembro ${index+1}`} onClick={()=>edit({members:draft.members.filter(m=>m.id!==member.id)})}>Quitar</button>
          {draft.playbackMode==='sequence'&&<><button type="button" aria-label={`Subir miembro ${index+1}`} disabled={index===0} onClick={()=>edit({members:moveBuilderMember(draft.members,index,index-1)})}>↑</button><button type="button" aria-label={`Bajar miembro ${index+1}`} disabled={index===draft.members.length-1} onClick={()=>edit({members:moveBuilderMember(draft.members,index,index+1)})}>↓</button></>}
        </td></tr>)}</tbody></table>
    </fieldset>
    {!current?<p role="status">Validando matemáticas y firma…</p>:current.error?<p role="alert">{current.error} No se corrigen los valores automáticamente.</p>:current.value&&<section aria-label="Vista previa de constelación">
      <h3>Vista previa · matemáticamente válida</h3>
      <dl className={styles.grid}><div><dt>Nombre</dt><dd>{current.value.name||'Sin nombre'}</dd></div><div><dt>Semilla</dt><dd>{current.value.seedFrequencyHz} Hz</dd></div><div><dt>Modo</dt><dd>{current.value.playbackMode}</dd></div><div><dt>Generación</dt><dd>{current.value.generationVersion}</dd></div></dl>
      <ol>{current.value.members.map((m,i)=><li key={m.id}>{i+1}. {relationship(m)} · {m.frequencyHz} Hz</li>)}</ol>
      <label>Firma de la constelación del Builder<input readOnly value={current.value.signature}/></label>
      <p><strong>Estado de reproducción: {labels[current.playability!.status]}</strong></p><p>{current.playability!.reason}</p><p>5:3 y 2:1 son relaciones matemáticas del Builder, no nuevos intervalos reproducibles. La compatibilidad estructural usa el contexto V1 actual; aquí no hay reproducción.</p>
      <button type="button" disabled={saved||saving||!!storageError} onClick={async()=>{
        if(savingRef.current)return;savingRef.current=true;setSaving(true);setNotice('');++historyRun.current;
        try{const rows=await new ConstellationStore(localStorage).create(current.value);if(mounted.current){setHistory(rows);setSaved(true);setNotice('Constelación guardada. No se inició audio ni se creó un experimento.');}}
        catch(e){if(mounted.current)setStorageError((e as Error).message);}
        finally{savingRef.current=false;if(mounted.current)setSaving(false);}
      }}>{saving?'Guardando constelación…':saved?'Constelación guardada':'Guardar constelación'}</button>
      <button type="button" disabled={saving} onClick={()=>exportJSON(JSON.stringify(current.value,null,2),`constelacion-${current.value!.id}.json`)}>Exportar constelación JSON</button>
    </section>}
    {saved&&<p>Registro guardado de solo lectura. No se permite reemplazarlo. Un nuevo borrador tendrá otro ID.</p>}
    <button type="button" disabled={saving} onClick={()=>{setDraft(newDraft());setSaved(false);setNotice('Nuevo borrador vacío. El anterior no se reemplaza.');}}>Nuevo borrador</button>
    {notice&&<p role="status">{notice}</p>}
    {storageError&&<div role="alert"><p>{storageError}</p><button type="button" onClick={()=>{try{exportJSON(localStorage.getItem(CONSTELLATIONS_KEY)??'null','constelaciones-original.json');}catch(e){setStorageError((e as Error).message);}}}>Exportar almacenamiento original de constelaciones</button></div>}
    <h3>Constelaciones guardadas ({history.length})</h3>
    <ul>{history.map(row=><li key={row.id}><button type="button" disabled={saving} aria-label={`Cargar constelación ${row.name||row.id}`} onClick={()=>{
      setDraft({id:row.id,...(row.name===undefined?{}:{name:row.name}),seedFrequencyHz:row.seedFrequencyHz,playbackMode:row.playbackMode,members:row.members.map(member=>{const {frequencyHz,...definition}=member;void frequencyHz;return definition;})});setSaved(true);setNotice('Constelación cargada en modo de lectura.');
    }}>{row.name||'Sin nombre'} · {row.seedFrequencyHz} Hz · Cargar</button>{onPreviewPlayback&&<button type="button" disabled={saving||playbackActive} aria-label={`Preparar reproducción de ${row.name||row.id}`} onClick={()=>onPreviewPlayback(row)}>Preparar reproducción</button>}</li>)}</ul>
  </div>;
}
export default function ConstellationBuilder(props: BuilderProps) {
  const [open,setOpen]=useState(false);
  return <details className={styles.container} onToggle={e=>{if(e.currentTarget.open)setOpen(true);}}><summary>Constructor de constelaciones · construir, validar y guardar</summary>{open&&<Builder {...props}/>}</details>;
}
